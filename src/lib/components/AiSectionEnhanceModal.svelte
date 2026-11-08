<script lang="ts">
  import type { Documentation, DocSection, AiProvider, AiEnhanceMode } from '../types';
  import { enhanceSectionWithAi, enhanceDocumentationWithAi } from '../aiGenerator';
  import {
    aiTaskState,
    startAiTask,
    updateAiTaskProgress,
    completeAiTask,
    failAiTask,
    cancelAiTask
  } from '../ai/aiTaskManager.svelte';
  import { showToast } from '../stores/toastStore.svelte';
  import { t } from '../i18n/index.svelte';
  import { getProviderLabel, getModelLabel } from '../ai/llmClient';

  interface Props {
    isOpen: boolean;
    initialScope?: 'section' | 'document';
    doc: Documentation | null;
    section: DocSection | null;
    apiKey?: string;
    provider?: AiProvider;
    selectedModel?: string;
    openrouterModel?: string;
    onClose: () => void;
    onSectionUpdated: (updatedSection: DocSection, targetDocId?: string) => void;
    onDocEnhanced: (docId: string, updatedSections: DocSection[]) => void;
  }

  let {
    isOpen,
    initialScope = 'section',
    doc,
    section,
    apiKey = '',
    provider = 'gemini',
    selectedModel,
    openrouterModel,
    onClose,
    onSectionUpdated,
    onDocEnhanced
  }: Props = $props();

  let scope = $state<'section' | 'document'>('section');
  let directive = $state('');
  let docMode = $state<AiEnhanceMode>('comprehensive');
  let customInstructions = $state('');
  let errorMessage = $state<string | null>(null);
  let activeModalTaskId = $state<string | null>(null);

  $effect(() => {
    if (isOpen) {
      scope = initialScope;
      errorMessage = null;
    }
  });

  let activeTask = $derived(
    activeModalTaskId
      ? aiTaskState.tasks.find((task) => task.id === activeModalTaskId && task.status === 'running') || null
      : null
  );
  let isEnhancing = $derived(activeTask !== null);

  function handleCloseModal() {
    activeModalTaskId = null;
    onClose();
  }

  const quickDirectives = [
    'Add practical runnable code examples with detailed comments and output',
    'Deepen explanations step-by-step and clarify underlying architecture',
    'Add production security guidelines, edge cases, and callout warnings',
    'Structure parameters and trade-offs using clean Markdown comparison tables',
    'Audit and fix any technical inaccuracies or incomplete snippets'
  ];

  const docModes: Array<{ id: AiEnhanceMode; label: string; icon: string; desc: string }> = [
    {
      id: 'comprehensive',
      label: 'Comprehensive Deep-Dive',
      icon: '🚀',
      desc: 'Expands explanations, clarifies concepts, and fills missing details across all sections.'
    },
    {
      id: 'code',
      label: 'Runnable Code & Examples',
      icon: '💻',
      desc: 'Injects runnable code blocks, CLI commands, and real-world implementations.'
    },
    {
      id: 'security',
      label: 'Security & Production Best Practices',
      icon: '🛡️',
      desc: 'Adds security checklists, production caveats, and GitHub alert callouts.'
    },
    {
      id: 'architecture',
      label: 'Architecture & Tables',
      icon: '🏛️',
      desc: 'Structures system flows with Markdown specification tables and component matrices.'
    },
    {
      id: 'custom',
      label: 'Custom Global Directive',
      icon: '✏️',
      desc: 'Revise all sections according to your own custom instructions below.'
    }
  ];

  async function handleSubmit(e: Event) {
    e.preventDefault();
    errorMessage = null;

    if (scope === 'section') {
      if (!section || !doc) return;
      if (!directive.trim()) {
        const msg = 'Please provide a directive or select a quick suggestion for this section.';
        errorMessage = msg;
        showToast({ type: 'warning', title: 'Missing Directive', message: msg });
        return;
      }

      const targetDocId = doc.id;
      const targetDocTitle = doc.title;
      const targetSection = { ...section };

      const { taskId, signal } = startAiTask(
        'enhance-section',
        `Enhance Section: ${targetSection.title}`,
        `Preparing directive for "${targetSection.title}"...`
      );
      activeModalTaskId = taskId;

      try {
        const updatedSection = await enhanceSectionWithAi(
          {
            docTitle: targetDocTitle,
            section: targetSection,
            instruction: directive.trim(),
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

        completeAiTask(taskId, `Section "${updatedSection.title}" enhanced.`);
        onSectionUpdated(updatedSection, targetDocId);
        if (activeModalTaskId === taskId) {
          activeModalTaskId = null;
          onClose();
          directive = '';
        }
      } catch (err: any) {
        const msg = err?.message || 'An unexpected error occurred while enhancing this section.';
        failAiTask(msg, taskId);
        if (activeModalTaskId === taskId) {
          activeModalTaskId = null;
          errorMessage = msg;
        }
      }
    } else {
      if (!doc) return;
      const targetDocSnapshot = { ...doc, sections: doc.sections.map((s) => ({ ...s })) };

      const { taskId, signal } = startAiTask(
        'enhance-doc',
        `Revise All: ${targetDocSnapshot.title}`,
        `Analyzing all ${targetDocSnapshot.sections.length} sections of "${targetDocSnapshot.title}"...`
      );
      activeModalTaskId = taskId;

      try {
        const updatedSections = await enhanceDocumentationWithAi(
          {
            doc: targetDocSnapshot,
            mode: docMode,
            customInstructions: customInstructions.trim(),
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

        completeAiTask(taskId, `All ${updatedSections.length} sections of "${targetDocSnapshot.title}" revised.`);
        onDocEnhanced(targetDocSnapshot.id, updatedSections);
        if (activeModalTaskId === taskId) {
          activeModalTaskId = null;
          onClose();
          customInstructions = '';
        }
      } catch (err: any) {
        const msg = err?.message || 'An unexpected error occurred while revising all sections.';
        failAiTask(msg, taskId);
        if (activeModalTaskId === taskId) {
          activeModalTaskId = null;
          errorMessage = msg;
        }
      }
    }
  }

  function handleStop() {
    if (activeModalTaskId) {
      cancelAiTask(activeModalTaskId);
      activeModalTaskId = null;
    }
    errorMessage = 'Enhancement was cancelled by user.';
  }
</script>

{#if isOpen && doc}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="modal-backdrop"
    onclick={(e) => e.target === e.currentTarget && handleCloseModal()}
    role="dialog"
    aria-modal="true"
    tabindex="-1"
  >
    <div class="modal-card">
      <!-- Header -->
      <div class="modal-header">
        <div class="header-icon-badge">✨</div>
        <div class="header-titles">
          <h2 class="modal-title">{t('enhanceModal.title', 'AI Documentation Enhancer')}</h2>
          <span class="modal-subtitle">
            {t('enhanceModal.subtitle', 'Enhance the active section or revise all sections across the document')}
          </span>
        </div>
        <button type="button" class="close-btn" onclick={handleCloseModal} title="Close (continues in TitleBar Tasks)">
          ✕
        </button>
      </div>

      <!-- 2-Way Mode Switcher: Active Section vs All Sections -->
      <div class="scope-tabs">
        <button
          type="button"
          class="scope-tab"
          class:active={scope === 'section'}
          onclick={() => (scope = 'section')}
          disabled={!section}
        >
          <span>🎯 {t('enhanceModal.tabSingleSection', 'Active Section Only')}</span>
          {#if section}
            <span class="scope-pill">{section.title}</span>
          {/if}
        </button>
        <button
          type="button"
          class="scope-tab"
          class:active={scope === 'document'}
          onclick={() => (scope = 'document')}
        >
          <span>📚 {t('enhanceModal.tabAllSections', 'All Sections (Full Doc)')}</span>
          <span class="scope-pill">{doc.sections.length} sections</span>
        </button>
      </div>

      <form onsubmit={handleSubmit} class="modal-form">
        <div class="modal-body">
          <!-- Active Engine Badge -->
          <div class="active-engine-badge">
            <span class="engine-dot"></span>
            <span class="engine-text">
              Active Engine: <strong>{getProviderLabel(provider)} · {getModelLabel(provider, openrouterModel, selectedModel)}</strong>
            </span>
            {#if !apiKey}
              <span class="engine-tag offline">Local Engine</span>
            {:else}
              <span class="engine-tag live">Live Cloud AI</span>
            {/if}
          </div>

          {#if errorMessage}
            <div class="error-banner">
              <div class="error-header-row">
                <span class="error-badge-title">
                  {errorMessage.includes('AI Provider Error') ? '⚠️ AI Provider Error' : '⚠️ Action Stopped'}
                </span>
                <button type="button" class="dismiss-error-btn" onclick={() => (errorMessage = null)}>✕</button>
              </div>
              <p class="error-body-text">{errorMessage}</p>
            </div>
          {/if}

          {#if scope === 'section' && section}
            <!-- MODE 1: SINGLE ACTIVE SECTION -->
            <div class="context-banner single">
              <div>
                <div class="ctx-label">Target Section (Strictly Isolated):</div>
                <div class="ctx-value">{doc.title} › <strong>{section.title}</strong></div>
              </div>
              <span class="isolation-badge">🔒 1 Section</span>
            </div>

            <div class="form-group">
              <label for="section-directive" class="group-label">
                {t('enhanceModal.directiveLabel', 'User Directive / Specific Instructions *')}
              </label>
              <textarea
                id="section-directive"
                bind:value={directive}
                disabled={isEnhancing}
                class="form-textarea"
                rows="4"
                placeholder="Describe what to add, expand, or fix in this section (e.g. Add runnable code examples, explain memory layout, add troubleshooting table)..."
              ></textarea>
            </div>

            <div class="quick-pills-wrap">
              <span class="pills-label">{t('enhanceModal.quickSuggestions', 'Quick Directives:')}</span>
              <div class="pills-list">
                {#each quickDirectives as q}
                  <button
                    type="button"
                    class="quick-pill"
                    disabled={isEnhancing}
                    onclick={() => (directive = directive ? `${directive}\n${q}` : q)}
                  >
                    + {q}
                  </button>
                {/each}
              </div>
            </div>
          {:else}
            <!-- MODE 2: ALL SECTIONS IN ACTIVE DOCUMENT -->
            <div class="context-banner all">
              <div>
                <div class="ctx-label">Target Document (All Sections Revised):</div>
                <div class="ctx-value"><strong>{doc.title}</strong> ({doc.sections.length} sections)</div>
              </div>
              <span class="isolation-badge all">📚 Full Document</span>
            </div>

            <div class="form-group">
              <span class="group-label">{t('enhanceModal.focusLabel', '1. Choose Revision Focus')}</span>
              <div class="mode-grid">
                {#each docModes as m}
                  <button
                    type="button"
                    class="mode-card"
                    class:selected={docMode === m.id}
                    onclick={() => (docMode = m.id)}
                    disabled={isEnhancing}
                  >
                    <span class="m-icon">{m.icon}</span>
                    <div class="m-info">
                      <span class="m-title">{m.label}</span>
                      <span class="m-desc">{m.desc}</span>
                    </div>
                  </button>
                {/each}
              </div>
            </div>

            <div class="form-group">
              <label for="doc-custom-inst" class="group-label">
                {t('enhanceModal.customGuidance', '2. Additional Guidance / Instructions (Optional)')}
              </label>
              <textarea
                id="doc-custom-inst"
                bind:value={customInstructions}
                disabled={isEnhancing}
                class="form-textarea"
                rows="3"
                placeholder="e.g. Ensure every section has a runnable code example and a best-practices callout box..."
              ></textarea>
            </div>
          {/if}

          <!-- Live Smooth Progress -->
          {#if isEnhancing && activeTask}
            <div class="progress-container">
              <div class="progress-status-row">
                <span class="progress-text">
                  <span class="pulsing-spinner"></span>
                  {activeTask.stepText || 'Processing with AI...'}
                </span>
                <span class="progress-pct">{Math.round(activeTask.progress)}%</span>
              </div>
              <div class="progress-bar-wrap">
                <div class="progress-bar-fill" style="width: {activeTask.progress}%"></div>
              </div>
              <div class="stop-btn-wrap">
                <span class="bg-hint">Tracked in the TitleBar <strong>Tasks</strong> menu if you close this modal.</span>
                <button type="button" class="stop-gen-btn" onclick={handleStop}>
                  ⏹ {t('enhanceModal.stop', 'Cancel Task')}
                </button>
              </div>
            </div>
          {/if}
        </div>

        <!-- Footer -->
        <div class="modal-footer">
          <button type="button" class="btn-cancel" onclick={handleCloseModal}>
            {isEnhancing ? t('enhanceModal.cancel', 'Run in Background') : 'Cancel'}
          </button>
          <button
            type="submit"
            class="btn-enhance"
            disabled={isEnhancing || (scope === 'section' && !directive.trim())}
          >
            {#if isEnhancing && activeTask}
              <span class="btn-spinner"></span>
              <span>{t('enhanceModal.enhancing', 'Enhancing...')} ({Math.round(activeTask.progress)}%)</span>
            {:else if scope === 'section'}
              <span>✨ {t('enhanceModal.enhanceSingleBtn', 'Enhance Active Section')}</span>
            {:else}
              <span>🚀 {t('enhanceModal.enhanceAllBtn', 'Revise All Sections')}</span>
            {/if}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.72);
    backdrop-filter: blur(5px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1100;
    padding: 16px;
  }

  .modal-card {
    background: var(--bg-surface);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    width: 100%;
    max-width: 640px;
    max-height: calc(100vh - 32px);
    box-shadow: 0 20px 55px rgba(0, 0, 0, 0.6);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .modal-header {
    display: flex;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border-color);
    gap: 12px;
    flex-shrink: 0;
  }

  .header-icon-badge {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(168, 85, 247, 0.2));
    color: var(--accent-color);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.2rem;
    flex-shrink: 0;
  }

  .header-titles {
    flex: 1;
    min-width: 0;
  }

  .modal-title {
    margin: 0;
    font-size: 16px;
    font-weight: 700;
    color: var(--text-primary);
  }

  .modal-subtitle {
    font-size: 12px;
    color: var(--text-secondary);
  }

  .close-btn {
    background: transparent;
    border: none;
    color: var(--text-secondary);
    font-size: 14px;
    cursor: pointer;
    width: 28px;
    height: 28px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .close-btn:hover {
    background: var(--btn-hover-bg);
    color: var(--text-primary);
  }

  .scope-tabs {
    display: grid;
    grid-template-columns: 1fr 1fr;
    background: var(--toolbar-bg);
    border-bottom: 1px solid var(--border-color);
    padding: 6px 12px;
    gap: 8px;
    flex-shrink: 0;
  }

  .scope-tab {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 7px;
    border: 1px solid transparent;
    background: transparent;
    color: var(--text-secondary);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    min-width: 0;
  }

  .scope-tab:hover:not(:disabled) {
    color: var(--text-primary);
    background: var(--btn-bg);
  }

  .scope-tab.active {
    background: var(--accent-subtle);
    border-color: var(--accent-color);
    color: var(--text-primary);
  }

  .scope-pill {
    font-size: 10.5px;
    padding: 2px 7px;
    border-radius: 4px;
    background: var(--btn-bg);
    color: var(--text-secondary);
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .modal-form {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .modal-body {
    padding: 18px 20px;
    display: flex;
    flex-direction: column;
    gap: 15px;
    overflow-y: auto;
    flex: 1;
    min-height: 0;
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
    box-shadow: 0 0 8px #10b981;
  }

  .engine-text {
    flex: 1;
    color: var(--text-primary);
  }

  .engine-tag {
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 4px;
    font-weight: 600;
  }

  .engine-tag.live {
    background: rgba(16, 185, 129, 0.15);
    color: #10b981;
  }

  .engine-tag.offline {
    background: rgba(245, 158, 11, 0.15);
    color: #f59e0b;
  }

  .context-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 10px 14px;
    border-radius: 8px;
    background: rgba(99, 102, 241, 0.08);
    border: 1px solid rgba(99, 102, 241, 0.25);
  }

  .ctx-label {
    font-size: 11px;
    color: var(--text-secondary);
  }

  .ctx-value {
    font-size: 12.5px;
    color: var(--text-primary);
    margin-top: 2px;
  }

  .isolation-badge {
    font-size: 11px;
    font-weight: 600;
    color: #10b981;
    background: rgba(16, 185, 129, 0.12);
    border: 1px solid rgba(16, 185, 129, 0.3);
    padding: 3px 8px;
    border-radius: 4px;
    white-space: nowrap;
  }

  .isolation-badge.all {
    color: #a5b4fc;
    background: rgba(99, 102, 241, 0.15);
    border-color: rgba(99, 102, 241, 0.35);
  }

  .error-banner {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.35);
    border-radius: 8px;
    padding: 10px 14px;
  }

  .error-header-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 4px;
  }

  .error-badge-title {
    font-size: 12px;
    font-weight: 700;
    color: #ef4444;
  }

  .dismiss-error-btn {
    background: transparent;
    border: none;
    color: #ef4444;
    cursor: pointer;
  }

  .error-body-text {
    margin: 0;
    font-size: 12px;
    color: #fca5a5;
    line-height: 1.4;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .group-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .form-textarea {
    width: 100%;
    background: var(--input-bg);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 10px 12px;
    color: var(--text-primary);
    font-size: 13px;
    font-family: inherit;
    resize: vertical;
    line-height: 1.5;
    box-sizing: border-box;
  }

  .form-textarea:focus {
    outline: none;
    border-color: var(--accent-color);
  }

  .quick-pills-wrap {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .pills-label {
    font-size: 11.5px;
    color: var(--text-secondary);
    font-weight: 600;
  }

  .pills-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .quick-pill {
    background: var(--btn-bg);
    border: 1px solid var(--border-color);
    border-radius: 14px;
    color: var(--text-secondary);
    font-size: 11.5px;
    padding: 4px 10px;
    cursor: pointer;
    transition: all 0.12s ease;
    text-align: left;
  }

  .quick-pill:hover:not(:disabled) {
    background: var(--accent-subtle);
    border-color: var(--accent-color);
    color: var(--text-primary);
  }

  .mode-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 8px;
  }

  .mode-card {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 8px;
    border: 1px solid var(--border-color);
    background: var(--input-bg);
    cursor: pointer;
    text-align: left;
    transition: all 0.15s ease;
  }

  .mode-card:hover:not(:disabled) {
    border-color: var(--accent-color);
  }

  .mode-card.selected {
    border-color: var(--accent-color);
    background: var(--accent-subtle);
  }

  .m-icon {
    font-size: 18px;
    flex-shrink: 0;
  }

  .m-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .m-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .m-desc {
    font-size: 11px;
    color: var(--text-secondary);
    line-height: 1.35;
  }

  .progress-container {
    background: var(--input-bg);
    border: 1px solid rgba(99, 102, 241, 0.35);
    border-radius: 8px;
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .progress-bar-wrap {
    height: 6px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 3px;
    overflow: hidden;
  }

  .progress-bar-fill {
    height: 100%;
    background: linear-gradient(90deg, #38bdf8, #6366f1, #a855f7);
    border-radius: 3px;
    transition: width 0.25s ease;
  }

  .progress-status-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 12px;
    font-weight: 600;
  }

  .progress-text {
    color: var(--accent-color);
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .pulsing-spinner {
    width: 11px;
    height: 11px;
    border: 2px solid var(--accent-color);
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }

  .progress-pct {
    font-family: 'JetBrains Mono', Consolas, monospace;
    color: var(--text-primary);
  }

  .stop-btn-wrap {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 8px;
  }

  .bg-hint {
    font-size: 11px;
    color: var(--text-secondary);
  }

  .stop-gen-btn {
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.35);
    color: #ef4444;
    font-size: 11px;
    font-weight: 600;
    padding: 4px 10px;
    border-radius: 5px;
    cursor: pointer;
  }

  .stop-gen-btn:hover {
    background: #ef4444;
    color: #ffffff;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    padding: 14px 20px;
    border-top: 1px solid var(--border-color);
    background: var(--toolbar-bg);
    flex-shrink: 0;
  }

  .btn-cancel {
    background: var(--btn-bg);
    border: 1px solid var(--border-color);
    color: var(--text-secondary);
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  }

  .btn-cancel:hover {
    background: var(--btn-hover-bg);
    color: var(--text-primary);
  }

  .btn-enhance {
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    border: none;
    color: #ffffff;
    padding: 8px 18px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
  }

  .btn-enhance:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-spinner {
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: #ffffff;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  @media (max-width: 560px) {
    .scope-tabs {
      grid-template-columns: 1fr;
    }
    .modal-footer {
      flex-direction: column-reverse;
      align-items: stretch;
    }
  }
</style>
