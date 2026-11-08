<script lang="ts">
  import type { Documentation } from '../types';
  import { t } from '../i18n/index.svelte';

  interface Props {
    isOpen: boolean;
    initialData?: Documentation | null;
    onClose: () => void;
    onSave: (docData: Partial<Documentation>) => void;
  }

  let { isOpen, initialData = null, onClose, onSave }: Props = $props();

  let title = $state('');
  let description = $state('');
  let category = $state('General');
  let version = $state('1.0.0');
  let author = $state('');
  let tagsInput = $state('');
  let initialSectionTitle = $state('1. Introduction & Overview');

  $effect(() => {
    if (isOpen) {
      if (initialData) {
        title = initialData.title || '';
        description = initialData.description || '';
        category = initialData.category || 'General';
        version = initialData.version || '1.0.0';
        author = initialData.author || '';
        tagsInput = (initialData.tags || []).join(', ');
      } else {
        title = '';
        description = '';
        category = 'General';
        version = '1.0.0';
        author = '';
        tagsInput = 'guide, documentation';
        initialSectionTitle = '1. Introduction & Overview';
      }
    }
  });

  function handleSubmit(e: Event) {
    e.preventDefault();
    if (!title.trim()) return;

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    onSave({
      title: title.trim(),
      description: description.trim(),
      category: category.trim() || 'General',
      version: version.trim() || '1.0.0',
      author: author.trim() || 'DokAI Author',
      tags,
      ...(initialData
        ? {}
        : {
            sections: [
              {
                id: 'sec-' + Date.now(),
                title: initialSectionTitle.trim() || 'Introduction',
                slug: 'introduction',
                order: 1,
                content: `## ${initialSectionTitle.trim() || 'Introduction'}\n\n${description.trim() || 'Created with DokAI technical studio.'}\n\n### Getting Started\n\nEnter your documentation content here.`
              }
            ]
          })
    });

    onClose();
  }
</script>

{#if isOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="modal-backdrop"
    onclick={(e) => e.target === e.currentTarget && onClose()}
    role="dialog"
    aria-modal="true"
    tabindex="-1"
  >
    <div class="modal-container">
      <div class="modal-header">
        <div class="header-text">
          <h2 class="modal-title">
            {initialData ? t('newDoc.editTitle', 'Edit Document Information') : t('newDoc.createTitle', 'Create New Document Manually')}
          </h2>
          <p class="modal-subtitle">
            {initialData
              ? t('newDoc.editSubtitle', 'Update title, description, category, and release version.')
              : t('newDoc.createSubtitle', 'Start an authored technical documentation from scratch.')}
          </p>
        </div>
        <button type="button" class="close-btn" onclick={onClose} title={t('common.close', 'Close')}>✕</button>
      </div>

      <form onsubmit={handleSubmit} class="modal-form">
        <div class="modal-body">
          <div class="form-group">
            <label class="group-label" for="doc-title">{t('newDoc.docTitleLabel', 'Document Title *')}</label>
            <input
              id="doc-title"
              type="text"
              bind:value={title}
              placeholder={t('newDoc.docTitlePlaceholder', 'e.g. Mobile App Architecture & Guidelines')}
              class="input-field"
              required
            />
          </div>

          <div class="form-grid-3">
            <div class="form-group">
              <label class="group-label" for="doc-category">{t('newDoc.categoryLabel', 'Category')}</label>
              <input
                id="doc-category"
                type="text"
                bind:value={category}
                placeholder={t('newDoc.categoryPlaceholder', 'e.g. Systems, Web, API')}
                class="input-field"
              />
            </div>

            <div class="form-group">
              <label class="group-label" for="doc-version">{t('newDoc.versionLabel', 'Version')}</label>
              <input
                id="doc-version"
                type="text"
                bind:value={version}
                placeholder={t('newDoc.versionPlaceholder', 'e.g. 1.0.0')}
                class="input-field"
              />
            </div>

            <div class="form-group">
              <label class="group-label" for="doc-author">{t('newDoc.authorLabel', 'Author / Maintainer')}</label>
              <input
                id="doc-author"
                type="text"
                bind:value={author}
                placeholder={t('newDoc.authorPlaceholder', 'e.g. Core Team')}
                class="input-field"
              />
            </div>
          </div>

          <div class="form-group">
            <label class="group-label" for="doc-description">{t('newDoc.descLabel', 'Description (Overview)')}</label>
            <textarea
              id="doc-description"
              bind:value={description}
              placeholder={t('newDoc.descPlaceholder', 'Summary of purpose, system capabilities, and scope...')}
              class="textarea-field"
              rows="3"
            ></textarea>
          </div>

          <div class="form-group">
            <label class="group-label" for="doc-tags">{t('newDoc.tagsLabel', 'Tags (Comma-separated)')}</label>
            <input
              id="doc-tags"
              type="text"
              bind:value={tagsInput}
              placeholder={t('newDoc.tagsPlaceholder', 'rust, javascript, architecture')}
              class="input-field"
            />
          </div>

          {#if !initialData}
            <div class="form-group">
              <label class="group-label" for="doc-init-sec">{t('newDoc.initSecLabel', 'Initial Section Title')}</label>
              <input
                id="doc-init-sec"
                type="text"
                bind:value={initialSectionTitle}
                placeholder={t('newDoc.initSecPlaceholder', '1. Introduction & Overview')}
                class="input-field"
              />
            </div>
          {/if}
        </div>

        <div class="modal-footer">
          <button type="button" class="btn secondary" onclick={onClose}>{t('common.cancel', 'Cancel')}</button>
          <button type="submit" class="btn primary">
            {initialData ? t('newDoc.saveChanges', 'Save Changes') : t('newDoc.createDoc', 'Create Document')}
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
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(5px);
    z-index: 1100;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
  }

  .modal-container {
    width: 100%;
    max-width: 560px;
    max-height: calc(100vh - 32px);
    background: var(--bg-surface);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.55);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .modal-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border-color);
    flex-shrink: 0;
  }

  .header-text {
    min-width: 0;
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
    margin: 3px 0 0 0;
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
    gap: 14px;
    overflow-y: auto;
    flex: 1;
    min-height: 0;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
  }

  .form-grid-3 {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(145px, 1fr));
    gap: 12px;
  }

  .group-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-primary);
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

  .btn.primary {
    background: var(--accent-color);
    color: #ffffff;
  }

  .btn.primary:hover {
    opacity: 0.95;
    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.35);
  }

  @media (max-width: 520px) {
    .form-grid-3 {
      grid-template-columns: 1fr;
    }
    .modal-footer {
      flex-direction: column-reverse;
      align-items: stretch;
    }
    .btn {
      width: 100%;
      text-align: center;
    }
  }
</style>
