<script lang="ts">
  import type { Documentation } from '../types';
  import { t } from '../i18n/index.svelte';
  import { showToast } from '../stores/toastStore.svelte';

  interface Props {
    allDocs: Documentation[];
    activeDocId: string;
    isOpen: boolean;
    position: 'left' | 'right';
    onOpenDoc: (docId: string) => void;
    onCreateNewDoc: () => void;
    onCloneDoc: (docId: string) => void;
    onDeleteDoc: (docId: string) => void;
    onToggleOpen: () => void;
    onTogglePosition: () => void;
  }

  let {
    allDocs,
    activeDocId,
    isOpen,
    position = 'left',
    onOpenDoc,
    onCreateNewDoc,
    onCloneDoc,
    onDeleteDoc,
    onToggleOpen,
    onTogglePosition
  }: Props = $props();

  let searchQuery = $state('');
  let selectedCategory = $state<string>('all');
  let confirmDeleteDocId = $state<string | null>(null);

  let categoryPillsEl = $state<HTMLDivElement | null>(null);

  function handlePillWheel(e: WheelEvent) {
    if (!categoryPillsEl) return;
    if (e.deltaY !== 0) {
      e.preventDefault();
      categoryPillsEl.scrollLeft += e.deltaY;
    }
  }

  let categories = $derived.by(() => {
    const set = new Set<string>();
    for (const d of allDocs) {
      if (d.category) set.add(d.category);
    }
    return ['all', ...Array.from(set)];
  });

  let filteredDocs = $derived.by(() => {
    return allDocs.filter((doc) => {
      if (selectedCategory !== 'all' && doc.category !== selectedCategory) {
        return false;
      }
      if (!searchQuery.trim()) return true;
      const tokens = searchQuery.toLowerCase().split(/\s+/).filter(Boolean);
      if (tokens.length === 0) return true;

      // Full-text tokenized search across document metadata and all section titles/content
      const docTitle = doc.title.toLowerCase();
      const docCat = (doc.category || '').toLowerCase();
      const docDesc = (doc.description || '').toLowerCase();
      const docTags = (doc.tags || []).map((t) => t.toLowerCase()).join(' ');
      const docSectionsTitles = (doc.sections || []).map((s) => s.title.toLowerCase()).join(' ');
      const docSectionsContent = (doc.sections || []).map((s) => (s.content || '').toLowerCase()).join(' ');

      const combinedText = `${docTitle} ${docCat} ${docDesc} ${docTags} ${docSectionsTitles} ${docSectionsContent}`;

      return tokens.every((token) => combinedText.includes(token));
    });
  });

  function handleClone(e: MouseEvent, doc: Documentation) {
    e.stopPropagation();
    onCloneDoc(doc.id);
    showToast({
      type: 'success',
      title: 'Document Cloned',
      message: `Created a copy of "${doc.title}".`
    });
  }

  function handleConfirmDelete(e: MouseEvent, doc: Documentation) {
    e.stopPropagation();
    onDeleteDoc(doc.id);
    confirmDeleteDocId = null;
    showToast({
      type: 'info',
      title: 'Document Deleted',
      message: `"${doc.title}" was removed.`
    });
  }
</script>

<!-- Mobile Backdrop -->
{#if isOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="docsbar-backdrop" onclick={onToggleOpen} aria-hidden="true"></div>
{/if}

<aside
  class="docs-explorer-bar"
  class:open={isOpen}
  class:closed={!isOpen}
  class:dock-right={position === 'right'}
>
  {#if isOpen}
    <!-- Top Header -->
    <div class="docs-bar-header">
      <div class="header-left">
        <span class="docs-title">{t('docsBar.title', 'DOCUMENTS')}</span>
        <span class="docs-count">{allDocs.length}</span>
      </div>
      <div class="header-actions">
        <button
          type="button"
          class="bar-icon-btn new-doc-btn"
          onclick={onCreateNewDoc}
          title={t('docsBar.newDoc', 'Create New Document Manually')}
        >
          + {t('docsBar.newBtn', 'New')}
        </button>
        <button
          type="button"
          class="bar-icon-btn"
          onclick={onTogglePosition}
          title={position === 'left' ? t('docsBar.moveToRight', 'Move Documents Bar to Right Side') : t('docsBar.moveToLeft', 'Move Documents Bar to Left Side')}
        >
          {position === 'left' ? '⇥' : '⇤'}
        </button>
        <button
          type="button"
          class="bar-icon-btn"
          onclick={onToggleOpen}
          title={t('docsBar.hideBar', 'Hide Documents Bar')}
        >
          ✕
        </button>
      </div>
    </div>

    <!-- Search Input -->
    <div class="docs-search-wrap">
      <div class="docs-search-box">
        <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input
          type="text"
          bind:value={searchQuery}
          placeholder={t('docsBar.searchPlaceholder', 'Search documents...')}
          class="docs-search-input"
        />
        {#if searchQuery}
          <button type="button" class="clear-btn" onclick={() => (searchQuery = '')}>✕</button>
        {/if}
      </div>
    </div>

    <!-- Category Pills with Horizontal Scroll Controls -->
    {#if categories.length > 2}
      <div class="category-pills-wrapper">
        <div
          class="category-pills"
          bind:this={categoryPillsEl}
          onwheel={handlePillWheel}
        >
          {#each categories as cat}
            <button
              type="button"
              class="cat-pill"
              class:active={selectedCategory === cat}
              onclick={() => (selectedCategory = cat)}
            >
              {cat === 'all' ? t('docsBar.allCategories', 'All') : cat}
            </button>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Documents List -->
    <div class="docs-list-scroll">
      {#if filteredDocs.length > 0}
        {#each filteredDocs as doc (doc.id)}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <div
            class="doc-card-item"
            class:active={doc.id === activeDocId}
            onclick={() => onOpenDoc(doc.id)}
            role="button"
            tabindex="0"
          >
            <div class="doc-card-top">
              <span class="doc-card-title" title={doc.title}>{doc.title}</span>
              <div class="doc-card-actions">
                <button
                  type="button"
                  class="doc-mini-btn"
                  onclick={(e) => handleClone(e, doc)}
                  title={t('docsBar.cloneDoc', 'Clone Document')}
                >
                  ⧉
                </button>
                {#if allDocs.length > 1}
                  <button
                    type="button"
                    class="doc-mini-btn danger"
                    onclick={(e) => {
                      e.stopPropagation();
                      confirmDeleteDocId = confirmDeleteDocId === doc.id ? null : doc.id;
                    }}
                    title={t('docsBar.deleteDoc', 'Delete Document')}
                  >
                    ✕
                  </button>
                {/if}
              </div>
            </div>

            <div class="doc-card-meta">
              <span class="doc-cat-badge">{doc.category || 'General'}</span>
              <span class="doc-sec-count">{doc.sections.length} sec</span>
              <span class="doc-ver">v{doc.version || '1.0'}</span>
            </div>

            {#if confirmDeleteDocId === doc.id}
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div class="inline-delete-confirm" onclick={(e) => e.stopPropagation()}>
                <span>{t('docsBar.deleteConfirm', 'Delete this doc?')}</span>
                <div class="confirm-btns">
                  <button type="button" class="yes-btn" onclick={(e) => handleConfirmDelete(e, doc)}>{t('common.delete', 'Delete')}</button>
                  <button type="button" class="no-btn" onclick={() => (confirmDeleteDocId = null)}>{t('common.cancel', 'Cancel')}</button>
                </div>
              </div>
            {/if}
          </div>
        {/each}
      {:else}
        <div class="docs-empty">
          <p>{t('docsBar.noDocsFound', 'No matching documents.')}</p>
        </div>
      {/if}
    </div>
  {/if}
</aside>

<style>
  .docs-explorer-bar {
    width: 235px;
    height: 100%;
    background: var(--titlebar-bg, #050505);
    border-right: 1px solid var(--border-color, #1a1a1a);
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    user-select: none;
    z-index: 55;
    overflow: hidden;
    transition: width 0.18s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .docs-explorer-bar.dock-right {
    border-right: none;
    border-left: 1px solid var(--border-color, #1a1a1a);
  }

  .docs-explorer-bar.closed {
    width: 0 !important;
    min-width: 0 !important;
    border: none !important;
    overflow: hidden !important;
    pointer-events: none !important;
  }

  .docs-bar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 10px 8px 12px;
    border-bottom: 1px solid var(--border-color, #1a1a1a);
    gap: 6px;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }

  .docs-title {
    font-size: 10.5px;
    font-weight: 800;
    letter-spacing: 0.7px;
    color: var(--text-secondary, #888);
    text-transform: uppercase;
  }

  .docs-count {
    font-size: 10px;
    font-weight: 700;
    padding: 1px 5px;
    border-radius: 99px;
    background: var(--accent-subtle, rgba(99, 102, 241, 0.14));
    color: var(--accent-color, #6366f1);
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .bar-icon-btn {
    height: 22px;
    min-width: 22px;
    padding: 0 5px;
    border-radius: 5px;
    border: 1px solid var(--border-color, #1a1a1a);
    background: var(--btn-bg, #141414);
    color: var(--text-secondary, #888);
    font-size: 10.5px;
    font-weight: 600;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: all 0.14s ease;
  }

  .bar-icon-btn:hover {
    background: var(--btn-hover-bg, #222);
    color: var(--text-primary, #fff);
  }

  .bar-icon-btn.new-doc-btn {
    background: var(--accent-subtle, rgba(99, 102, 241, 0.15));
    border-color: rgba(99, 102, 241, 0.35);
    color: var(--accent-color, #6366f1);
    font-weight: 700;
  }

  .bar-icon-btn.new-doc-btn:hover {
    background: var(--accent-color, #6366f1);
    color: #ffffff;
  }

  .docs-search-wrap {
    padding: 8px 10px 6px 10px;
  }

  .docs-search-box {
    display: flex;
    align-items: center;
    gap: 6px;
    background: var(--input-bg, #050505);
    border: 1px solid var(--border-color, #1a1a1a);
    border-radius: 6px;
    padding: 4px 8px;
    color: var(--text-secondary, #888);
  }

  .docs-search-box:focus-within {
    border-color: var(--accent-color, #6366f1);
  }

  .docs-search-input {
    width: 100%;
    border: none;
    background: transparent;
    color: var(--text-primary, #ededed);
    font-size: 11.5px;
    outline: none;
  }

  .clear-btn {
    border: none;
    background: transparent;
    color: var(--text-secondary, #888);
    font-size: 10px;
    cursor: pointer;
    padding: 0;
  }

  .category-pills-wrapper {
    position: relative;
    display: flex;
    align-items: center;
    padding: 0 6px 8px 6px;
    min-width: 0;
  }

  .category-pills {
    display: flex;
    align-items: center;
    gap: 5px;
    overflow-x: auto;
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.15) transparent;
    padding: 2px 4px 5px 4px;
    width: 100%;
    scroll-behavior: smooth;
  }

  .category-pills::-webkit-scrollbar {
    height: 3px;
  }

  .category-pills::-webkit-scrollbar-track {
    background: transparent;
  }

  .category-pills::-webkit-scrollbar-thumb {
    background: var(--border-color, #222);
    border-radius: 99px;
  }

  .cat-pill {
    flex-shrink: 0;
    padding: 3px 9px;
    border-radius: 99px;
    border: 1px solid var(--border-color, #1a1a1a);
    background: var(--btn-bg, #141414);
    color: var(--text-secondary, #888);
    font-size: 10.5px;
    font-weight: 600;
    white-space: nowrap;
    cursor: pointer;
    transition: all 0.12s ease;
  }

  .cat-pill:hover {
    color: var(--text-primary);
    border-color: var(--border-hover-color);
  }

  .cat-pill.active {
    background: var(--accent-color, #6366f1);
    border-color: var(--accent-color, #6366f1);
    color: #ffffff;
  }

  .docs-list-scroll {
    flex: 1;
    overflow-y: auto;
    padding: 4px 8px 14px 8px;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .doc-card-item {
    display: flex;
    flex-direction: column;
    gap: 5px;
    padding: 8px 10px;
    border-radius: 7px;
    border: 1px solid transparent;
    background: rgba(255, 255, 255, 0.015);
    cursor: pointer;
    transition: all 0.14s ease;
  }

  .doc-card-item:hover {
    background: var(--btn-bg, #141414);
    border-color: var(--border-color, #1a1a1a);
  }

  .doc-card-item.active {
    background: var(--accent-subtle, rgba(99, 102, 241, 0.12));
    border-color: rgba(99, 102, 241, 0.45);
  }

  .doc-card-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 6px;
  }

  .doc-card-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-primary, #ededed);
    line-height: 1.35;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .doc-card-item.active .doc-card-title {
    color: #a5b4fc;
    font-weight: 700;
  }

  .doc-card-actions {
    display: flex;
    align-items: center;
    gap: 2px;
    opacity: 0;
    transition: opacity 0.12s ease;
    flex-shrink: 0;
  }

  .doc-card-item:hover .doc-card-actions {
    opacity: 1;
  }

  .doc-mini-btn {
    width: 19px;
    height: 19px;
    border-radius: 4px;
    border: none;
    background: transparent;
    color: var(--text-secondary, #888);
    font-size: 10px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .doc-mini-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    color: var(--text-primary, #fff);
  }

  .doc-mini-btn.danger:hover {
    background: rgba(239, 68, 68, 0.2);
    color: #f87171;
  }

  .doc-card-meta {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 10px;
    color: var(--text-secondary, #888);
  }

  .doc-cat-badge {
    background: rgba(255, 255, 255, 0.05);
    padding: 1px 5px;
    border-radius: 3px;
    font-weight: 600;
    max-width: 110px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .doc-sec-count,
  .doc-ver {
    opacity: 0.75;
  }

  .inline-delete-confirm {
    margin-top: 4px;
    padding: 6px 8px;
    border-radius: 5px;
    background: rgba(239, 68, 68, 0.14);
    border: 1px solid rgba(239, 68, 68, 0.35);
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 10.5px;
    color: #fca5a5;
  }

  .confirm-btns {
    display: flex;
    gap: 4px;
  }

  .yes-btn,
  .no-btn {
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 10px;
    font-weight: 700;
    cursor: pointer;
    border: none;
  }

  .yes-btn {
    background: #ef4444;
    color: #fff;
  }

  .no-btn {
    background: rgba(255, 255, 255, 0.1);
    color: var(--text-primary, #fff);
  }

  .docs-empty {
    padding: 24px 12px;
    text-align: center;
    font-size: 11.5px;
    color: var(--text-secondary, #888);
  }

  .docsbar-backdrop {
    display: none;
  }

  @media (max-width: 900px) {
    .docsbar-backdrop {
      display: block;
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.65);
      backdrop-filter: blur(3px);
      z-index: 140;
    }

    .docs-explorer-bar {
      position: fixed;
      top: 44px;
      bottom: 0;
      left: 0;
      width: min(290px, 85vw);
      max-width: 85vw;
      box-shadow: 8px 0 28px rgba(0, 0, 0, 0.75);
      z-index: 150;
    }

    .docs-explorer-bar.dock-right {
      left: auto;
      right: 0;
      box-shadow: -8px 0 28px rgba(0, 0, 0, 0.75);
    }
  }
</style>
