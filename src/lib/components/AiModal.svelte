<script lang="ts">
  import type { DocTemplateType, Documentation, AiProvider } from '../types';
  import { generateDocumentationWithAi, type OutputLanguage, type DocDepth } from '../aiGenerator';
  import {
    aiTaskState,
    startAiTask,
    updateAiTaskProgress,
    completeAiTask,
    failAiTask,
    cancelAiTask
  } from '../ai/aiTaskManager.svelte';
  import { showToast } from '../stores/toastStore.svelte';
  import { t, getAvailableLocales } from '../i18n/index.svelte';
  import { getProviderLabel, getModelLabel } from '../ai/llmClient';

  interface Props {
    isOpen: boolean;
    apiKey?: string;
    provider?: AiProvider;
    selectedModel?: string;
    openrouterModel?: string;
    onClose: () => void;
    onDocCreated: (newDoc: Documentation) => void;
  }

  let { isOpen, apiKey = '', provider = 'gemini', selectedModel, openrouterModel, onClose, onDocCreated }: Props = $props();

  let title = $state('');
  let topic = $state('');
  const author = 'AI Created';
  let description = $state('');
  let templateType = $state<DocTemplateType>('api');
  let sourceCode = $state('');
  let language = $state<OutputLanguage>('auto');
  let depth = $state<DocDepth>('standard');
  let errorMessage = $state<string | null>(null);
  let activeModalTaskId = $state<string | null>(null);

  let activeTask = $derived(
    activeModalTaskId
      ? aiTaskState.tasks.find((task) => task.id === activeModalTaskId && task.status === 'running') || null
      : null
  );
  let isGenerating = $derived(activeTask !== null);

  function handleCloseModal() {
    // Detach modal from task so user can reopen AI Generator to launch another concurrent task
    activeModalTaskId = null;
    onClose();
  }

  const templates: Array<{ id: DocTemplateType; label: string; icon: string; desc: string }> = [
    { id: 'api', label: 'REST API Reference', icon: '🌐', desc: 'Endpoints, Headers, Auth, Status Codes' },
    { id: 'guide', label: 'Getting Started Guide', icon: '📖', desc: 'Step-by-step setup, features & FAQ' },
    { id: 'architecture', label: 'System Architecture', icon: '🏛️', desc: 'Data flows, logical layers & schemas' },
    { id: 'sdk', label: 'SDK & Library', icon: '📦', desc: 'Installation, classes, methods & snippets' },
    { id: 'code_to_doc', label: 'Code to Documentation', icon: '💻', desc: 'Reverse engineer documentation from code' }
  ];

  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (!title.trim() && !topic.trim()) {
      const msg = 'Please provide at least a document title or focal topic.';
      errorMessage = msg;
      showToast({ type: 'warning', title: 'Missing Input', message: msg });
      return;
    }

    errorMessage = null;
    const docLabel = title.trim() || topic.trim();
    const { taskId, signal } = startAiTask(
      'generate',
      `AI Doc: ${docLabel}`,
      'Initializing DokAI generator engine...'
    );
    activeModalTaskId = taskId;

    try {
      const generated = await generateDocumentationWithAi(
        {
          title: docLabel,
          topic: topic.trim() || title.trim(),
          templateType,
          description: description.trim(),
          sourceCode: sourceCode.trim(),
          apiKey: (apiKey || '').trim() || undefined,
          provider,
          selectedModel,
          openrouterModel,
          author: 'AI Created',
          language,
          depth,
          onProgress: (step, pct) => {
            updateAiTaskProgress(step, pct, taskId);
          }
        },
        signal
      );

      completeAiTask(taskId, `"${generated.title}" generated (${generated.sections.length} sections).`);
      onDocCreated(generated);
      if (activeModalTaskId === taskId) {
        activeModalTaskId = null;
        onClose();
        resetForm();
      }
    } catch (err: any) {
      const msg = err?.message || 'An unexpected error occurred during documentation synthesis.';
      failAiTask(msg, taskId);
      if (activeModalTaskId === taskId) {
        activeModalTaskId = null;
        errorMessage = msg;
      }
    }
  }

  function handleStopGeneration() {
    if (activeModalTaskId) {
      cancelAiTask(activeModalTaskId);
      activeModalTaskId = null;
    }
    errorMessage = 'Generation was stopped by the user.';
  }

  function resetForm() {
    title = '';
    topic = '';
    description = '';
    sourceCode = '';
    errorMessage = null;
  }
</script>

{#if isOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="modal-backdrop"
    onclick={(e) => e.target === e.currentTarget && handleCloseModal()}
    role="dialog"
    aria-modal="true"
    tabindex="-1"
  >
    <div class="modal-container">
      <div class="modal-header">
        <div class="header-title-zone">
          <div class="ai-avatar">
            <svg class="sparkle-anim" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L14.4 7.6L20 10L14.4 12.4L12 18L9.6 12.4L4 10L9.6 7.6L12 2Z" />
            </svg>
          </div>
          <div class="header-text">
            <h2 class="modal-title">{t('aiModal.title', 'Generate Docs with DokAI')}</h2>
            <p class="modal-subtitle">{t('aiModal.subtitle', 'Synthesize multi-section technical documentation with AI.')}</p>
          </div>
        </div>
        <button type="button" class="close-btn" onclick={handleCloseModal} title="Close (continues in TitleBar Tasks if running)">✕</button>
      </div>

      <form onsubmit={handleSubmit} class="modal-form">
        <div class="modal-body">
          <div class="active-engine-badge">
            <span class="engine-dot"></span>
            <span class="engine-text">
              Active Engine: <strong>{getProviderLabel(provider)} · {getModelLabel(provider, openrouterModel, selectedModel)}</strong>
            </span>
            {#if !apiKey}
              <span class="engine-tag offline">Local Template Engine</span>
            {:else}
              <span class="engine-tag live">Live Cloud AI</span>
            {/if}
          </div>

          {#if errorMessage}
            <div class="error-banner">
              <div class="error-header-row">
                <span class="error-badge-title">
                  {errorMessage.includes('AI Provider Error') ? '⚠️ AI Provider Error' : '⚠️ Generation Stopped'}
                </span>
                <button type="button" class="dismiss-error-btn" onclick={() => (errorMessage = null)} title="Dismiss">✕</button>
              </div>
              <p class="error-body-text">{errorMessage}</p>
            </div>
          {/if}

          <!-- Template Selection -->
          <div class="form-group">
            <span class="group-label">{t('aiModal.templateLabel', '1. Documentation Template')}</span>
            <div class="template-grid">
              {#each templates as tpl}
                <button
                  type="button"
                  class="template-card"
                  class:selected={templateType === tpl.id}
                  onclick={() => (templateType = tpl.id)}
                  disabled={isGenerating}
                >
                  <div class="tpl-icon">{tpl.icon}</div>
                  <div class="tpl-info">
                    <span class="tpl-title">{tpl.label}</span>
                    <span class="tpl-desc">{tpl.desc}</span>
                  </div>
                </button>
              {/each}
            </div>
          </div>

          <!-- Title & Topic -->
          <div class="form-grid-2">
            <div class="form-group">
              <label class="group-label" for="doc-title-input">{t('aiModal.docTitleLabel', '2. Document Title *')}</label>
              <input
                id="doc-title-input"
                type="text"
                bind:value={title}
                disabled={isGenerating}
                placeholder="e.g. Modern C++20 Systems Guide"
                class="input-field"
                required
              />
            </div>

            <div class="form-group">
              <label class="group-label" for="doc-topic-input">{t('aiModal.topicLabel', '3. Subject / Keywords *')}</label>
              <input
                id="doc-topic-input"
                type="text"
                bind:value={topic}
                disabled={isGenerating}
                placeholder="e.g. RAII, Smart Pointers, Templates, Concurrency"
                class="input-field"
                required
              />
            </div>
          </div>

          <!-- Language & Depth (Author is fixed as "AI Created") -->
          <div class="form-grid-2">
            <div class="form-group">
              <label class="group-label" for="doc-ai-lang">{t('aiModal.langLabel', '4. Output Language')}</label>
              <select id="doc-ai-lang" bind:value={language} disabled={isGenerating} class="input-field">
                <option value="auto">Auto (Match Input / Prompt)</option>
                {#each getAvailableLocales() as loc}
                  <option value={loc.code}>{loc.flag} {loc.nativeName} ({loc.name})</option>
                {/each}
              </select>
            </div>

            <div class="form-group">
              <label class="group-label" for="doc-ai-depth">{t('aiModal.depthLabel', '5. Depth')}</label>
              <select id="doc-ai-depth" bind:value={depth} disabled={isGenerating} class="input-field">
                <option value="concise">Concise (4-5 sections)</option>
                <option value="standard">Standard (6-8 sections)</option>
                <option value="in_depth">In-Depth (8-10 sections)</option>
              </select>
            </div>
          </div>

          <!-- Description -->
          <div class="form-group">
            <label class="group-label" for="doc-desc-input">{t('aiModal.descLabel', '7. Description / Target Audience (Optional)')}</label>
            <textarea
              id="doc-desc-input"
              bind:value={description}
              disabled={isGenerating}
              placeholder="Brief summary of requirements, system constraints, or intended readers..."
              class="textarea-field"
              rows="2"
            ></textarea>
          </div>

          <!-- Source Code (if Code to Doc) -->
          {#if templateType === 'code_to_doc' || sourceCode.length > 0}
            <div class="form-group">
              <label class="group-label" for="doc-code-input">{t('aiModal.codeLabel', '8. Source Code / Type Definitions (Optional)')}</label>
              <textarea
                id="doc-code-input"
                bind:value={sourceCode}
                disabled={isGenerating}
                placeholder="// Paste TypeScript, Python, Go, Rust, C++, or JSON schema here..."
                class="textarea-field code"
                rows="4"
              ></textarea>
            </div>
          {/if}

          <!-- Progress Box with Live Smooth Status and Stop Button -->
          {#if isGenerating && activeTask}
            <div class="progress-box">
              <div class="progress-info">
                <span class="progress-step-text">
                  <span class="step-spinner"></span>
                  {activeTask.stepText || 'Synthesizing documentation...'}
                </span>
                <span class="progress-pct">{Math.round(activeTask.progress)}%</span>
              </div>
              <div class="progress-track">
                <div class="progress-bar" style="width: {activeTask.progress}%;"></div>
              </div>
              <div class="generating-toolbar">
                <span class="generating-hint">
                  You can close this window safely — all tasks are tracked in the TitleBar <strong>Tasks</strong> menu.
                </span>
                <button type="button" class="stop-gen-btn" onclick={handleStopGeneration}>
                  ⏹ {t('aiModal.stop', 'Cancel Generation')}
                </button>
              </div>
            </div>
          {/if}
        </div>

        <!-- Actions -->
        <div class="modal-footer">
          <button type="button" class="btn secondary" onclick={handleCloseModal}>
            {isGenerating ? t('aiModal.cancel', 'Run in Background') : 'Cancel'}
          </button>
          <button type="submit" class="btn primary ai-submit" disabled={isGenerating}>
            {#if isGenerating && activeTask}
              <span class="spinner"></span>
              <span>{t('aiModal.synthesizing', 'Synthesizing...')} ({Math.round(activeTask.progress)}%)</span>
            {:else}
              <svg class="sparkle-icon" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <path d="M12 2L14.4 7.6L20 10L14.4 12.4L12 18L9.6 12.4L4 10L9.6 7.6L12 2Z" />
              </svg>
              <span>{t('aiModal.submit', 'Generate Document')}</span>
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
    z-index: 1100;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
  }

  .modal-container {
    width: 100%;
    max-width: 680px;
    max-height: calc(100vh - 32px);
    background: var(--bg-surface);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    box-shadow: 0 20px 55px rgba(0, 0, 0, 0.6);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border-color);
    flex-shrink: 0;
  }

  .header-title-zone {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
  }

  .header-text {
    min-width: 0;
  }

  .ai-avatar {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #ffffff;
    box-shadow: 0 4px 12px rgba(168, 85, 247, 0.35);
    flex-shrink: 0;
  }

  .sparkle-anim {
    width: 20px;
    height: 20px;
    animation: rotate-sparkle 6s linear infinite;
  }

  @keyframes rotate-sparkle {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .modal-title {
    font-size: 16px;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0;
  }

  .modal-subtitle {
    font-size: 12px;
    color: var(--text-secondary);
    margin: 2px 0 0 0;
  }

  .close-btn {
    background: transparent;
    border: none;
    font-size: 14px;
    color: var(--text-secondary);
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
    padding: 8px 12px;
    background: var(--bg-base);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    font-size: 12px;
    color: var(--text-secondary);
  }

  .engine-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--accent-color);
    box-shadow: 0 0 8px var(--accent-color);
    flex-shrink: 0;
  }

  .engine-text {
    flex: 1;
    min-width: 140px;
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .engine-tag {
    font-size: 11px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 4px;
    white-space: nowrap;
  }

  .engine-tag.live {
    background: rgba(16, 185, 129, 0.15);
    color: #10b981;
    border: 1px solid rgba(16, 185, 129, 0.3);
  }

  .engine-tag.offline {
    background: rgba(148, 163, 184, 0.15);
    color: var(--text-secondary);
  }

  .error-banner {
    background: rgba(239, 68, 68, 0.12);
    border: 1px solid #ef4444;
    color: #ef4444;
    padding: 10px 14px;
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .error-header-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .error-badge-title {
    font-size: 12.5px;
    font-weight: 700;
    color: #ef4444;
  }

  .dismiss-error-btn {
    background: transparent;
    border: none;
    color: #ef4444;
    font-size: 13px;
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 4px;
  }

  .error-body-text {
    margin: 0;
    font-size: 12px;
    line-height: 1.45;
    color: #fca5a5;
    word-break: break-word;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
  }

  .form-grid-2 {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 12px;
  }


  .group-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .template-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(175px, 1fr));
    gap: 8px;
  }

  .template-card {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 10px;
    background: var(--input-bg);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    cursor: pointer;
    text-align: left;
    transition: all 0.15s ease;
    min-width: 0;
  }

  .template-card:hover:not(:disabled) {
    border-color: var(--accent-color);
  }

  .template-card.selected {
    border-color: var(--accent-color);
    background: var(--accent-subtle);
    box-shadow: 0 0 0 1px var(--accent-color);
  }

  .tpl-icon {
    font-size: 18px;
    flex-shrink: 0;
  }

  .tpl-info {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .tpl-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .tpl-desc {
    font-size: 10.5px;
    color: var(--text-secondary);
    line-height: 1.3;
    margin-top: 2px;
  }

  .input-field,
  .textarea-field {
    width: 100%;
    background: var(--input-bg);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    padding: 8px 11px;
    font-size: 13px;
    color: var(--text-primary);
    outline: none;
    transition: border-color 0.15s ease;
    box-sizing: border-box;
  }

  .input-field:focus,
  .textarea-field:focus {
    border-color: var(--accent-color);
  }

  .textarea-field {
    resize: vertical;
    line-height: 1.5;
  }

  .textarea-field.code {
    font-family: 'JetBrains Mono', Consolas, monospace;
    font-size: 12px;
  }

  .progress-box {
    background: var(--input-bg);
    border: 1px solid rgba(99, 102, 241, 0.35);
    border-radius: 8px;
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .progress-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    font-weight: 600;
  }

  .progress-step-text {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--accent-color);
    min-width: 0;
  }

  .step-spinner {
    width: 12px;
    height: 12px;
    border: 2px solid var(--accent-color);
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    flex-shrink: 0;
  }

  .generating-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 2px;
  }

  .generating-hint {
    font-size: 11px;
    color: var(--text-secondary);
    line-height: 1.3;
  }

  .stop-gen-btn {
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.35);
    color: #ef4444;
    font-size: 11px;
    font-weight: 600;
    padding: 4px 10px;
    border-radius: 6px;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.15s ease;
  }

  .stop-gen-btn:hover {
    background: #ef4444;
    color: #ffffff;
  }

  .progress-pct {
    color: var(--text-primary);
    font-family: 'JetBrains Mono', Consolas, monospace;
    flex-shrink: 0;
  }

  .progress-track {
    width: 100%;
    height: 6px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 3px;
    overflow: hidden;
  }

  .progress-bar {
    height: 100%;
    background: linear-gradient(90deg, #38bdf8 0%, #6366f1 50%, #a855f7 100%);
    border-radius: 3px;
    transition: width 0.25s ease;
  }

  .modal-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
    padding: 14px 20px;
    border-top: 1px solid var(--border-color);
    background: var(--toolbar-bg);
    flex-shrink: 0;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    border: 1px solid transparent;
    transition: all 0.15s ease;
  }

  .btn.secondary {
    background: var(--btn-bg);
    border-color: var(--border-color);
    color: var(--text-secondary);
  }

  .btn.secondary:hover {
    background: var(--btn-hover-bg);
    color: var(--text-primary);
  }

  .btn.primary.ai-submit {
    background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
    color: #ffffff;
    box-shadow: 0 4px 14px rgba(99, 102, 241, 0.3);
  }

  .btn.primary.ai-submit:hover:not(:disabled) {
    opacity: 0.95;
  }

  .btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .spinner {
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

  @media (max-width: 540px) {
    .modal-footer {
      flex-direction: column-reverse;
      align-items: stretch;
    }
    .btn {
      width: 100%;
    }
  }
</style>
