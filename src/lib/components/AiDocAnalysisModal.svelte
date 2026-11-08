<script lang="ts">
  import type { Documentation, DocSection, DocAnalysisReport, DocAnalysisIssue, IssueSeverity, AiProvider } from '../types';
  import { analyzeDocumentWithAi, enhanceSectionWithAi } from '../aiGenerator';
  import {
    aiTaskState,
    startAiTask,
    updateAiTaskProgress,
    completeAiTask,
    failAiTask,
    cancelAiTask
  } from '../ai/aiTaskManager.svelte';
  import { showToast } from '../stores/toastStore.svelte';
  import { getProviderLabel, getModelLabel } from '../ai/llmClient';

  interface Props {
    isOpen: boolean;
    doc: Documentation | null;
    apiKey?: string;
    provider?: AiProvider;
    selectedModel?: string;
    openrouterModel?: string;
    onClose: () => void;
    onSelectSection?: (secId: string) => void;
    onSectionUpdated?: (updatedSection: DocSection, targetDocId?: string) => void;
  }

  let {
    isOpen,
    doc,
    apiKey = '',
    provider = 'gemini',
    selectedModel,
    openrouterModel,
    onClose,
    onSelectSection,
    onSectionUpdated
  }: Props = $props();

  let activeAuditTaskId = $state<string | null>(null);
  let activeAuditTask = $derived(
    activeAuditTaskId
      ? aiTaskState.tasks.find((t) => t.id === activeAuditTaskId && t.status === 'running') || null
      : null
  );
  let isAnalyzing = $derived(activeAuditTask !== null);
  let errorMessage = $state<string | null>(null);
  let report = $state<DocAnalysisReport | null>(null);
  let activeSeverityFilter = $state<IssueSeverity | 'all'>('all');
  let copiedIssueId = $state<string | null>(null);
  let lastAuditedDocId = $state<string | null>(null);
  let fixingIssueId = $state<string | null>(null);
  let fixedIssueIds = $state<Record<string, boolean>>({});

  function findSectionForIssue(issue: DocAnalysisIssue): DocSection | null {
    if (!doc) return null;
    if (issue.sectionId) {
      const byId = doc.sections.find(s => s.id === issue.sectionId);
      if (byId) return byId;
    }
    if (issue.sectionTitle) {
      const norm = issue.sectionTitle.toLowerCase().trim();
      const byTitle = doc.sections.find(
        s => s.title.toLowerCase().trim() === norm || s.title.toLowerCase().includes(norm)
      );
      if (byTitle) return byTitle;
    }
    return doc.sections[0] || null;
  }

  function handleJumpToSection(issue: DocAnalysisIssue) {
    const targetSec = findSectionForIssue(issue);
    if (targetSec && onSelectSection) {
      onSelectSection(targetSec.id);
      onClose();
    }
  }

  async function handleAutoFixIssue(issue: DocAnalysisIssue) {
    if (!doc || !onSectionUpdated || fixingIssueId) return;
    const targetSec = findSectionForIssue(issue);
    if (!targetSec) return;

    const targetDocId = doc.id;
    fixingIssueId = issue.id;
    errorMessage = null;
    try {
      const directive = `Fix this audit issue in section "${targetSec.title}":\n- Issue (${issue.severity}): ${issue.title}\n- Problem: ${issue.explanation}\n- Suggested Fix: ${issue.suggestedFix}`;
      const updated = await enhanceSectionWithAi({
        docTitle: doc.title,
        section: targetSec,
        instruction: directive,
        apiKey: (apiKey || '').trim() || undefined,
        provider,
        selectedModel,
        openrouterModel
      });
      onSectionUpdated(updated, targetDocId);
      fixedIssueIds = { ...fixedIssueIds, [issue.id]: true };
      showToast({
        type: 'success',
        title: 'Audit Issue Auto-Fixed',
        message: `Fixed "${issue.title}" in section "${targetSec.title}".`
      });
    } catch (err: any) {
      const msg = err?.message || 'Failed to auto-fix section.';
      errorMessage = msg;
      showToast({
        type: 'error',
        title: 'Auto-Fix Error',
        message: msg
      });
    } finally {
      fixingIssueId = null;
    }
  }

  // Trigger analysis automatically when modal opens if no report exists for this doc
  $effect(() => {
    if (isOpen && doc && lastAuditedDocId !== doc.id && !isAnalyzing) {
      lastAuditedDocId = doc.id;
      fixedIssueIds = {};
      runAudit();
    }
  });

  async function runAudit() {
    if (!doc) return;

    errorMessage = null;
    const targetDoc = { ...doc, sections: doc.sections.map((s) => ({ ...s })) };
    const { taskId, signal } = startAiTask(
      'audit',
      `Audit: ${targetDoc.title}`,
      `Initiating technical audit for "${targetDoc.title}"...`
    );
    activeAuditTaskId = taskId;

    try {
      const generatedReport = await analyzeDocumentWithAi(
        {
          doc: targetDoc,
          apiKey: (apiKey || '').trim() || undefined,
          provider,
          selectedModel,
          openrouterModel,
          onProgress: (step, pct) => {
            updateAiTaskProgress(step, pct, taskId);
          }
        },
        signal
      );

      report = generatedReport;
      completeAiTask(
        taskId,
        `Audit completed for "${targetDoc.title}" (Health Score: ${generatedReport.healthScore}/100, ${generatedReport.issues.length} findings).`
      );
      if (activeAuditTaskId === taskId) {
        activeAuditTaskId = null;
      }
    } catch (err: any) {
      const msg = err?.message || 'An error occurred while auditing the document.';
      failAiTask(msg, taskId);
      if (activeAuditTaskId === taskId) {
        activeAuditTaskId = null;
        errorMessage = msg;
      }
    }
  }

  function handleStop() {
    if (activeAuditTaskId) {
      cancelAiTask(activeAuditTaskId);
      activeAuditTaskId = null;
    }
    errorMessage = 'Audit was stopped by user.';
  }

  function handleCopyFix(text: string, id: string) {
    navigator.clipboard.writeText(text);
    copiedIssueId = id;
    setTimeout(() => {
      if (copiedIssueId === id) copiedIssueId = null;
    }, 2000);
  }

  let filteredIssues = $derived.by(() => {
    if (!report) return [];
    if (activeSeverityFilter === 'all') return report.issues;
    return report.issues.filter(i => i.severity === activeSeverityFilter);
  });

  let severityCounts = $derived.by(() => {
    if (!report) return { critical: 0, inaccuracy: 0, warning: 0, suggestion: 0, all: 0 };
    return {
      all: report.issues.length,
      critical: report.issues.filter(i => i.severity === 'critical').length,
      inaccuracy: report.issues.filter(i => i.severity === 'inaccuracy').length,
      warning: report.issues.filter(i => i.severity === 'warning').length,
      suggestion: report.issues.filter(i => i.severity === 'suggestion').length
    };
  });
</script>

{#if isOpen && doc}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="modal-backdrop"
    onclick={(e) => e.target === e.currentTarget && onClose()}
    role="dialog"
    aria-modal="true"
    tabindex="-1"
  >
    <div class="modal-card">
      <!-- Header -->
      <div class="modal-header">
        <div class="header-icon-badge">🔍</div>
        <div class="header-titles">
          <h2 class="modal-title">AI Document Audit & Accuracy Report</h2>
          <span class="modal-subtitle">Detect factual inaccuracies, compilation bugs, and missing information</span>
        </div>
        <button
          type="button"
          class="close-btn"
          onclick={onClose}
          title="Close Modal (continues in background)"
        >
          ✕
        </button>
      </div>

      <!-- Document Overview Banner -->
      <div class="doc-overview-banner">
        <div class="doc-name-group">
          <span class="doc-icon">📄</span>
          <span class="doc-name">{doc.title}</span>
          <span class="doc-category-badge">{doc.category}</span>
        </div>
        <div class="banner-right">
          {#if report && !isAnalyzing}
            <div
              class="health-score-badge"
              class:good={report.healthScore >= 85}
              class:warning={report.healthScore >= 70 && report.healthScore < 85}
              class:poor={report.healthScore < 70}
            >
              <span class="health-label">Health Score</span>
              <span class="health-val">{report.healthScore}/100</span>
            </div>
          {/if}
          <button
            type="button"
            class="re-audit-btn"
            disabled={isAnalyzing}
            onclick={runAudit}
            title="Re-run Analysis"
          >
            🔄 Re-Audit
          </button>
        </div>
      </div>

      <!-- Modal Body -->
      <div class="modal-body">
        <div class="active-engine-badge">
          <span class="engine-dot"></span>
          <span class="engine-text">
            Active Engine: <strong>{getProviderLabel(provider)} · {getModelLabel(provider, openrouterModel, selectedModel)}</strong>
          </span>
          {#if !apiKey}
            <span class="engine-tag offline">Local Heuristic Engine</span>
          {:else}
            <span class="engine-tag live">Live Cloud AI</span>
          {/if}
        </div>

        {#if errorMessage}
          <div class="error-banner">
            <div class="error-header-row">
              <span class="error-badge-title">
                {errorMessage.includes('AI Provider Error') ? '⚠️ AI Provider Error' : '⚠️ Audit Stopped'}
              </span>
              <button type="button" class="dismiss-error-btn" onclick={() => (errorMessage = null)} title="Dismiss">✕</button>
            </div>
            <p class="error-body-text">{errorMessage}</p>
          </div>
        {/if}

        <!-- Progress Indicator -->
        {#if isAnalyzing && activeAuditTask}
          <div class="progress-container">
            <div class="progress-bar-wrap">
              <div class="progress-bar-fill" style="width: {activeAuditTask.progress}%"></div>
            </div>
            <div class="progress-status-row">
              <span class="progress-text">
                <span class="pulsing-spinner"></span>
                {activeAuditTask.stepText || 'Auditing document for mistakes...'}
              </span>
              <span class="progress-pct">{Math.round(activeAuditTask.progress)}%</span>
            </div>
            <div class="stop-btn-wrap">
              <button type="button" class="stop-gen-btn" onclick={handleStop}>
                ⏹ Cancel
              </button>
            </div>
          </div>
        {:else if report}
          <!-- Executive Summary -->
          <div class="summary-card">
            <div class="summary-header">
              <span class="summary-icon">📋</span>
              <span class="summary-title">Executive Audit Summary</span>
            </div>
            <p class="summary-text">{report.summary}</p>
          </div>

          <!-- Severity Filter Tabs -->
          <div class="filter-strip">
            <button
              type="button"
              class="filter-pill"
              class:active={activeSeverityFilter === 'all'}
              onclick={() => (activeSeverityFilter = 'all')}
            >
              All Issues ({severityCounts.all})
            </button>
            <button
              type="button"
              class="filter-pill pill-critical"
              class:active={activeSeverityFilter === 'critical'}
              onclick={() => (activeSeverityFilter = 'critical')}
            >
              🚨 Critical ({severityCounts.critical})
            </button>
            <button
              type="button"
              class="filter-pill pill-inaccuracy"
              class:active={activeSeverityFilter === 'inaccuracy'}
              onclick={() => (activeSeverityFilter = 'inaccuracy')}
            >
              ⚠️ Inaccuracies ({severityCounts.inaccuracy})
            </button>
            <button
              type="button"
              class="filter-pill pill-warning"
              class:active={activeSeverityFilter === 'warning'}
              onclick={() => (activeSeverityFilter = 'warning')}
            >
              ⚡ Warnings ({severityCounts.warning})
            </button>
            <button
              type="button"
              class="filter-pill pill-suggestion"
              class:active={activeSeverityFilter === 'suggestion'}
              onclick={() => (activeSeverityFilter = 'suggestion')}
            >
              💡 Suggestions ({severityCounts.suggestion})
            </button>
          </div>

          <!-- Issues List -->
          {#if filteredIssues.length === 0}
            <div class="empty-issues">
              <span class="empty-icon">✅</span>
              <span class="empty-title">No issues found in this filter!</span>
              <span class="empty-desc">The document meets all accuracy and syntax guidelines for this category.</span>
            </div>
          {:else}
            <div class="issues-list">
              {#each filteredIssues as issue (issue.id)}
                <div class="issue-card severity-{issue.severity}">
                  <div class="issue-top-row">
                    <div class="badges-row">
                      <span class="severity-badge {issue.severity}">
                        {issue.severity.toUpperCase()}
                      </span>
                      {#if issue.sectionTitle}
                        <span class="section-tag" title={issue.sectionTitle}>
                          Section: {issue.sectionTitle}
                        </span>
                      {/if}
                    </div>
                    <div class="issue-actions-row">
                      {#if onSelectSection}
                        <button
                          type="button"
                          class="jump-sec-btn"
                          onclick={() => handleJumpToSection(issue)}
                          title="Open this section in the editor"
                        >
                          ↗ Go to Section
                        </button>
                      {/if}
                      {#if onSectionUpdated}
                        <button
                          type="button"
                          class="autofix-sec-btn"
                          class:fixed={fixedIssueIds[issue.id]}
                          disabled={fixingIssueId !== null || fixedIssueIds[issue.id]}
                          onclick={() => handleAutoFixIssue(issue)}
                          title="Apply AI fix directly to this section"
                        >
                          {#if fixingIssueId === issue.id}
                            Fixing...
                          {:else if fixedIssueIds[issue.id]}
                            Fixed ✓
                          {:else}
                            ✨ Auto-Fix Section
                          {/if}
                        </button>
                      {/if}
                    </div>
                  </div>

                  <h3 class="issue-title">{issue.title}</h3>
                  <div class="issue-explanation">
                    <strong class="expl-label">Problem / Flaw:</strong>
                    <span>{issue.explanation}</span>
                  </div>

                  {#if issue.suggestedFix}
                    <div class="fix-box">
                      <div class="fix-header">
                        <span class="fix-title">💡 Proposed Correction & Fix:</span>
                        <button
                          type="button"
                          class="copy-fix-btn"
                          onclick={() => handleCopyFix(issue.suggestedFix, issue.id)}
                          title="Copy Suggested Fix to Clipboard"
                        >
                          {copiedIssueId === issue.id ? 'Copied ✓' : '📋 Copy Fix'}
                        </button>
                      </div>
                      <pre class="fix-content">{issue.suggestedFix}</pre>
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
          {/if}
        {/if}
      </div>

      <!-- Footer -->
      <div class="modal-footer">
        <button type="button" class="btn-close-main" onclick={onClose}>
          Done
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(6px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    padding: 16px;
    animation: fadeIn 0.16s ease-out;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .modal-card {
    background: var(--bg-surface, #1e1e2e);
    border: 1px solid var(--border-color, #2d2d3f);
    border-radius: 12px;
    width: 100%;
    max-width: 780px;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 20px 48px rgba(0, 0, 0, 0.5);
    display: flex;
    flex-direction: column;
    animation: scaleUp 0.16s ease-out;
  }

  @keyframes scaleUp {
    from { transform: scale(0.96); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }

  .modal-header {
    display: flex;
    align-items: center;
    padding: 18px 24px;
    border-bottom: 1px solid var(--border-color, #2d2d3f);
    gap: 12px;
  }

  .header-icon-badge {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    background: linear-gradient(135deg, rgba(56, 189, 248, 0.2), rgba(99, 102, 241, 0.2));
    color: #38bdf8;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.25rem;
    flex-shrink: 0;
  }

  .header-titles {
    flex: 1;
  }

  .modal-title {
    margin: 0;
    font-size: 1.15rem;
    font-weight: 600;
    color: var(--text-primary, #ffffff);
  }

  .modal-subtitle {
    font-size: 0.8rem;
    color: var(--text-secondary, #94a3b8);
  }

  .close-btn {
    background: transparent;
    border: none;
    color: var(--text-secondary, #94a3b8);
    font-size: 1.1rem;
    cursor: pointer;
    padding: 6px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s;
  }

  .close-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.08);
    color: var(--text-primary, #ffffff);
  }

  .doc-overview-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: rgba(56, 189, 248, 0.06);
    border-bottom: 1px solid rgba(56, 189, 248, 0.15);
    padding: 12px 24px;
    gap: 12px;
  }

  .doc-name-group {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .doc-icon {
    font-size: 1.1rem;
  }

  .doc-name {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--text-primary, #ffffff);
  }

  .doc-category-badge {
    font-size: 0.72rem;
    background: rgba(255, 255, 255, 0.08);
    padding: 2px 7px;
    border-radius: 6px;
    color: var(--text-secondary, #94a3b8);
  }

  .banner-right {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .health-score-badge {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 0.78rem;
    font-weight: 600;
    border: 1px solid transparent;
  }

  .health-score-badge.good {
    background: rgba(16, 185, 129, 0.15);
    color: #10b981;
    border-color: rgba(16, 185, 129, 0.3);
  }

  .health-score-badge.warning {
    background: rgba(245, 158, 11, 0.15);
    color: #f59e0b;
    border-color: rgba(245, 158, 11, 0.3);
  }

  .health-score-badge.poor {
    background: rgba(239, 68, 68, 0.15);
    color: #ef4444;
    border-color: rgba(239, 68, 68, 0.3);
  }

  .health-label {
    opacity: 0.8;
  }

  .re-audit-btn {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--border-color, #2d2d3f);
    border-radius: 6px;
    color: var(--text-primary, #ffffff);
    font-size: 0.78rem;
    font-weight: 500;
    padding: 5px 10px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .re-audit-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.1);
  }

  .modal-body {
    padding: 20px 24px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .summary-card {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid var(--border-color, #2d2d3f);
    border-radius: 8px;
    padding: 14px 16px;
  }

  .summary-header {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.84rem;
    font-weight: 600;
    color: #38bdf8;
    margin-bottom: 6px;
  }

  .summary-text {
    margin: 0;
    font-size: 0.84rem;
    color: var(--text-secondary, #cbd5e1);
    line-height: 1.45;
  }

  .filter-strip {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .filter-pill {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid var(--border-color, #2d2d3f);
    color: var(--text-secondary, #94a3b8);
    border-radius: 14px;
    font-size: 0.75rem;
    font-weight: 500;
    padding: 4px 10px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .filter-pill:hover {
    color: var(--text-primary, #ffffff);
    background: rgba(255, 255, 255, 0.06);
  }

  .filter-pill.active {
    background: var(--primary, #6366f1);
    border-color: var(--primary, #6366f1);
    color: #ffffff;
    font-weight: 600;
  }

  .filter-pill.pill-critical.active {
    background: #ef4444;
    border-color: #ef4444;
  }

  .filter-pill.pill-inaccuracy.active {
    background: #f97316;
    border-color: #f97316;
  }

  .filter-pill.pill-warning.active {
    background: #eab308;
    border-color: #eab308;
    color: #000;
  }

  .filter-pill.pill-suggestion.active {
    background: #3b82f6;
    border-color: #3b82f6;
  }

  .empty-issues {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 20px;
    background: rgba(16, 185, 129, 0.04);
    border: 1px dashed rgba(16, 185, 129, 0.3);
    border-radius: 8px;
    text-align: center;
  }

  .empty-icon {
    font-size: 2.2rem;
    margin-bottom: 8px;
  }

  .empty-title {
    font-size: 0.95rem;
    font-weight: 600;
    color: #10b981;
    margin-bottom: 4px;
  }

  .empty-desc {
    font-size: 0.8rem;
    color: var(--text-secondary, #94a3b8);
  }

  .issues-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .issue-card {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid var(--border-color, #2d2d3f);
    border-left: 4px solid var(--border-color, #2d2d3f);
    border-radius: 8px;
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .issue-card.severity-critical {
    border-left-color: #ef4444;
    background: rgba(239, 68, 68, 0.03);
  }

  .issue-card.severity-inaccuracy {
    border-left-color: #f97316;
    background: rgba(249, 115, 22, 0.03);
  }

  .issue-card.severity-warning {
    border-left-color: #eab308;
    background: rgba(234, 179, 8, 0.03);
  }

  .issue-card.severity-suggestion {
    border-left-color: #3b82f6;
    background: rgba(59, 130, 246, 0.03);
  }

  .issue-top-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .badges-row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .severity-badge {
    font-size: 0.68rem;
    font-weight: 700;
    padding: 2px 7px;
    border-radius: 4px;
    letter-spacing: 0.3px;
  }

  .severity-badge.critical {
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
  }

  .severity-badge.inaccuracy {
    background: rgba(249, 115, 22, 0.2);
    color: #f97316;
  }

  .severity-badge.warning {
    background: rgba(234, 179, 8, 0.2);
    color: #eab308;
  }

  .severity-badge.suggestion {
    background: rgba(59, 130, 246, 0.2);
    color: #60a5fa;
  }

  .section-tag {
    font-size: 0.72rem;
    color: #94a3b8;
    background: rgba(255, 255, 255, 0.05);
    padding: 2px 7px;
    border-radius: 4px;
  }

  .issue-title {
    margin: 0;
    font-size: 0.92rem;
    font-weight: 600;
    color: var(--text-primary, #ffffff);
  }

  .issue-explanation {
    font-size: 0.82rem;
    color: #cbd5e1;
    line-height: 1.4;
  }

  .expl-label {
    color: #fca5a5;
    margin-right: 4px;
  }

  .fix-box {
    background: rgba(0, 0, 0, 0.28);
    border: 1px solid var(--border-color, #2d2d3f);
    border-radius: 6px;
    padding: 10px 12px;
  }

  .fix-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 6px;
  }

  .fix-title {
    font-size: 0.75rem;
    font-weight: 600;
    color: #10b981;
  }

  .copy-fix-btn {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid var(--border-color, #2d2d3f);
    color: var(--text-secondary, #94a3b8);
    font-size: 0.7rem;
    padding: 2px 7px;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .copy-fix-btn:hover {
    background: rgba(255, 255, 255, 0.12);
    color: var(--text-primary, #ffffff);
  }

  .fix-content {
    margin: 0;
    font-size: 0.8rem;
    color: #a7f3d0;
    white-space: pre-wrap;
    word-break: break-word;
    font-family: inherit;
    line-height: 1.4;
  }

  .active-engine-badge {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    font-size: 12px;
    color: var(--text-secondary);
    background: var(--bg-base);
    padding: 8px 12px;
    border-radius: 8px;
    border: 1px solid var(--border-color);
  }

  .engine-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #10b981;
    box-shadow: 0 0 6px rgba(16, 185, 129, 0.6);
  }

  .engine-text {
    flex: 1;
    min-width: 150px;
  }

  .engine-text strong {
    color: var(--text-primary);
  }

  .engine-tag {
    font-size: 10px;
    padding: 2px 7px;
    border-radius: 4px;
    font-weight: 600;
  }

  .engine-tag.live {
    background: rgba(16, 185, 129, 0.15);
    color: #10b981;
    border: 1px solid rgba(16, 185, 129, 0.3);
  }

  .engine-tag.offline {
    background: rgba(148, 163, 184, 0.15);
    color: #94a3b8;
    border: 1px solid rgba(148, 163, 184, 0.3);
  }

  .progress-container {
    background: rgba(56, 189, 248, 0.06);
    border: 1px solid rgba(56, 189, 248, 0.2);
    border-radius: 8px;
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .progress-bar-wrap {
    height: 6px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
    overflow: hidden;
  }

  .progress-bar-fill {
    height: 100%;
    background: linear-gradient(90deg, #38bdf8, #818cf8);
    border-radius: 3px;
    transition: width 0.3s ease;
  }

  .progress-status-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.8rem;
  }

  .progress-text {
    color: var(--text-primary, #ffffff);
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .pulsing-spinner {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #38bdf8;
    animation: pulse 1s infinite alternate;
  }

  @keyframes pulse {
    from { opacity: 0.3; transform: scale(0.8); }
    to { opacity: 1; transform: scale(1.2); }
  }

  .progress-pct {
    font-weight: 600;
    color: #38bdf8;
  }

  .stop-btn-wrap {
    display: flex;
    justify-content: flex-end;
  }

  .stop-gen-btn {
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #ef4444;
    font-size: 0.76rem;
    font-weight: 500;
    padding: 5px 10px;
    border-radius: 4px;
    cursor: pointer;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    padding: 14px 24px;
    border-top: 1px solid var(--border-color, #2d2d3f);
  }

  .btn-close-main {
    background: var(--primary, #6366f1);
    border: none;
    color: #ffffff;
    padding: 7px 18px;
    border-radius: 6px;
    font-size: 0.84rem;
    font-weight: 600;
    cursor: pointer;
  }

  .btn-close-main:hover {
    opacity: 0.92;
  }

  .error-banner {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 8px;
    padding: 12px 14px;
  }

  .error-header-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 6px;
  }

  .error-badge-title {
    font-size: 0.82rem;
    font-weight: 600;
    color: #ef4444;
  }

  .dismiss-error-btn {
    background: transparent;
    border: none;
    color: #ef4444;
    cursor: pointer;
    font-size: 0.85rem;
  }

  .error-body-text {
    margin: 0;
    font-size: 0.8rem;
    color: #fca5a5;
    line-height: 1.4;
  }

  .issue-actions-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .jump-sec-btn {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid var(--border-color, #2d2d3f);
    color: var(--text-secondary, #a1a1aa);
    font-size: 0.72rem;
    font-weight: 500;
    padding: 4px 9px;
    border-radius: 5px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .jump-sec-btn:hover {
    background: rgba(255, 255, 255, 0.12);
    color: var(--text-primary, #ffffff);
  }

  .autofix-sec-btn {
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(168, 85, 247, 0.2));
    border: 1px solid rgba(129, 140, 248, 0.4);
    color: #a5b4fc;
    font-size: 0.72rem;
    font-weight: 600;
    padding: 4px 10px;
    border-radius: 5px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .autofix-sec-btn:hover:not(:disabled) {
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.35), rgba(168, 85, 247, 0.35));
    color: #ffffff;
  }

  .autofix-sec-btn.fixed {
    background: rgba(16, 185, 129, 0.18);
    border-color: rgba(16, 185, 129, 0.45);
    color: #34d399;
  }

  .autofix-sec-btn:disabled {
    opacity: 0.7;
    cursor: default;
  }
</style>

