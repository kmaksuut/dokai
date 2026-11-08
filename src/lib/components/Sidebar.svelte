<script lang="ts">
  import type { Documentation, DocSection } from '../types';
  import { t } from '$lib/i18n/index.svelte';

  interface Props {
    currentDoc: Documentation | null;
    activeSectionId: string;
    isOpen: boolean;
    sidebarWidth: number;
    onSelectSection: (sectionId: string) => void;
    onAddSection: () => void;
    onDeleteSection: (sectionId: string) => void;
    onRenameSection: (sectionId: string, newTitle: string) => void;
    onMoveSection: (sectionId: string, direction: 'up' | 'down') => void;
    onEditDocMeta: () => void;
    onToggleSidebar: () => void;
    onResizeWidth: (newWidth: number) => void;
  }

  let {
    currentDoc,
    activeSectionId,
    isOpen,
    sidebarWidth,
    onSelectSection,
    onAddSection,
    onDeleteSection,
    onRenameSection,
    onMoveSection,
    onEditDocMeta,
    onToggleSidebar,
    onResizeWidth
  }: Props = $props();

  let searchQuery = $state('');
  let editingSectionId = $state<string | null>(null);
  let editInputTitle = $state('');
  let isResizing = $state(false);
  let liveWidth = $state<number | null>(null);
  let sidebarEl = $state<HTMLElement | null>(null);
  let effectiveWidth = $derived(isResizing && liveWidth !== null ? liveWidth : sidebarWidth);

  // Confirm delete modal state
  let sectionPendingDelete = $state<DocSection | null>(null);

  // Active Section
  let activeSection = $derived(
    currentDoc?.sections.find(s => s.id === activeSectionId) || currentDoc?.sections[0] || null
  );

  // Filtered Sections
  let filteredSections = $derived(
    (currentDoc?.sections || []).filter(sec => {
      if (!searchQuery.trim()) return true;
      const tokens = searchQuery.toLowerCase().split(/\s+/).filter(Boolean);
      if (tokens.length === 0) return true;

      const docTitle = (currentDoc?.title || '').toLowerCase();
      const secTitle = sec.title.toLowerCase();
      const secContent = (sec.content || '').toLowerCase();
      const combined = `${docTitle} ${secTitle} ${secContent}`;

      return tokens.every(token => combined.includes(token));
    })
  );

  // Table of Contents generator - supports all heading levels H1 to H6 (up to 10+ subheadings)
  let tableOfContents = $derived(() => {
    if (!activeSection) return [];
    const lines = activeSection.content.split('\n');
    const headings: Array<{ level: number; text: string; slug: string }> = [];

    for (const line of lines) {
      // Match from # through ###### (H1 to H6, enabling 10+ deep hierarchical headings)
      const match = line.match(/^(#{1,6})\s+(.+)$/);
      if (match) {
        const level = match[1].length;
        const rawText = match[2].trim().replace(/[#*`_]/g, '');
        const slug = rawText
          .toLowerCase()
          .replace(/[^\w\s-]/g, '')
          .replace(/\s+/g, '-');
        headings.push({ level, text: rawText, slug });
      }
    }
    return headings;
  });

  function startRename(sec: DocSection) {
    editingSectionId = sec.id;
    editInputTitle = sec.title;
  }

  function saveRename(secId: string) {
    if (editInputTitle.trim()) {
      onRenameSection(secId, editInputTitle.trim());
    }
    editingSectionId = null;
  }

  function handleKeydown(e: KeyboardEvent, secId: string) {
    if (e.key === 'Enter') {
      saveRename(secId);
    } else if (e.key === 'Escape') {
      editingSectionId = null;
    }
  }

  function scrollToHeading(slug: string) {
    const el = document.getElementById(slug);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  // Delete Confirmation Helpers
  function promptDelete(sec: DocSection) {
    sectionPendingDelete = sec;
  }

  function confirmDelete() {
    if (sectionPendingDelete) {
      onDeleteSection(sectionPendingDelete.id);
      sectionPendingDelete = null;
    }
  }

  function cancelDelete() {
    sectionPendingDelete = null;
  }

  // Resizer Mouse Drag Logic - Relative Delta calculation with requestAnimationFrame
  function startResizing(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    isResizing = true;

    const startX = e.clientX;
    const startWidth = sidebarEl ? sidebarEl.getBoundingClientRect().width : sidebarWidth;
    let latestWidth = startWidth;
    let rafId: number | null = null;

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    function handleMouseMove(moveEvent: MouseEvent) {
      if (!isResizing) return;
      const delta = moveEvent.clientX - startX;
      latestWidth = Math.min(Math.max(Math.round(startWidth + delta), 180), 650);

      if (rafId === null) {
        rafId = requestAnimationFrame(() => {
          liveWidth = latestWidth;
          onResizeWidth(latestWidth);
          rafId = null;
        });
      }
    }

    function handleMouseUp() {
      isResizing = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      liveWidth = null;
      onResizeWidth(latestWidth);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('mouseup', handleMouseUp);
  }
</script>

<!-- Mobile Backdrop -->
{#if isOpen}
  <div class="sidebar-backdrop" onclick={onToggleSidebar} aria-hidden="true"></div>
{/if}

<aside
  bind:this={sidebarEl}
  class="dokai-sidebar"
  class:open={isOpen}
  class:closed={!isOpen}
  class:resizing={isResizing}
  style="width: {isOpen ? effectiveWidth : 0}px;"
>
  {#if isOpen}
    <!-- Sidebar Header: Document Meta -->
    <div class="sidebar-header">
      {#if currentDoc}
        <div class="doc-badge-row">
          <span class="category-tag">{currentDoc.category || 'General'}</span>
          <span class="version-tag">v{currentDoc.version || '1.0.0'}</span>
          {#if currentDoc.author}
            <span class="author-tag" title="Author: {currentDoc.author}">👤 {currentDoc.author}</span>
          {/if}
        </div>
        <div class="doc-title-row">
          <h2 class="doc-title" title={currentDoc.title}>{currentDoc.title}</h2>
          <button class="icon-btn edit-meta-btn" onclick={onEditDocMeta} title="Edit Document Information">
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </button>
        </div>
        {#if currentDoc.description}
          <p class="doc-desc">{currentDoc.description}</p>
        {/if}
      {:else}
        <div class="no-doc-placeholder">No document selected</div>
      {/if}
    </div>

    <!-- Search Box -->
    <div class="search-box-wrapper">
      <div class="search-input-group">
        <svg class="search-icon" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input
          type="text"
          placeholder={t('sidebar.filterSections')}
          bind:value={searchQuery}
          class="search-input"
        />
        {#if searchQuery}
          <button class="clear-search-btn" onclick={() => (searchQuery = '')}>✕</button>
        {/if}
      </div>
    </div>

    <!-- Sections List -->
    <div class="sections-scroll-area">
      <div class="sections-header">
        <span class="sections-heading-label">{t('sidebar.sections')} ({currentDoc?.sections.length || 0})</span>
        <button class="add-section-btn" onclick={onAddSection} title={t('sidebar.addSection')}>
          <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2.5" fill="none">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          <span>{t('sidebar.addSection')}</span>
        </button>
      </div>

      <div class="sections-list">
        {#if currentDoc && filteredSections.length > 0}
          {#each filteredSections as sec, index (sec.id)}
            <div
              class="section-item"
              class:active={sec.id === activeSectionId}
              onclick={() => onSelectSection(sec.id)}
              role="button"
              tabindex="0"
              onkeydown={(e) => e.key === 'Enter' && onSelectSection(sec.id)}
            >
              <div class="section-main">
                <span class="section-order-num">{index + 1}</span>

                {#if editingSectionId === sec.id}
                  <!-- svelte-ignore a11y_autofocus -->
                  <input
                    type="text"
                    class="rename-input"
                    bind:value={editInputTitle}
                    onblur={() => saveRename(sec.id)}
                    onkeydown={(e) => handleKeydown(e, sec.id)}
                    onclick={(e) => e.stopPropagation()}
                    autofocus
                  />
                {:else}
                  <span class="section-title-text" title={sec.title}>{sec.title}</span>
                {/if}
              </div>

              <!-- Section Item Action Icons -->
              <div class="section-actions">
                {#if index > 0}
                  <button
                    class="sec-act-btn"
                    title={t('sidebar.moveUp', 'Move Up')}
                    onclick={(e) => { e.stopPropagation(); onMoveSection(sec.id, 'up'); }}
                  >
                    ▲
                  </button>
                {/if}

                {#if index < filteredSections.length - 1}
                  <button
                    class="sec-act-btn"
                    title={t('sidebar.moveDown', 'Move Down')}
                    onclick={(e) => { e.stopPropagation(); onMoveSection(sec.id, 'down'); }}
                  >
                    ▼
                  </button>
                {/if}

                <button
                  class="sec-act-btn"
                  title={t('sidebar.renameSection', 'Rename Section')}
                  onclick={(e) => { e.stopPropagation(); startRename(sec); }}
                >
                  ✎
                </button>

                {#if currentDoc.sections.length > 1}
                  <!-- Triggers confirmation modal instead of immediate delete -->
                  <button
                    class="sec-act-btn delete"
                    title={t('sidebar.deleteSection', 'Delete Section')}
                    onclick={(e) => { e.stopPropagation(); promptDelete(sec); }}
                  >
                    ✕
                  </button>
                {/if}
              </div>
            </div>

            <!-- Active Section Table of Contents with multi-level headings (H1-H6) -->
            {#if sec.id === activeSectionId && tableOfContents().length > 0}
              <div class="section-toc-list">
                {#each tableOfContents() as heading}
                  <button
                    class="toc-item level-{heading.level}"
                    onclick={() => scrollToHeading(heading.slug)}
                  >
                    <span class="toc-bullet">{"·".repeat(Math.max(1, heading.level - 1))}</span>
                    <span class="toc-text">{heading.text}</span>
                  </button>
                {/each}
              </div>
            {/if}
          {/each}
        {:else if searchQuery}
          <div class="empty-state">
            <p>{t('sidebar.noMatchingSections', 'No matching sections found.')}</p>
          </div>
        {:else}
          <div class="empty-state">
            <p>{t('sidebar.noSectionsYet', 'No sections created yet.')}</p>
            <button class="primary-btn sm" onclick={onAddSection}>{t('sidebar.addFirstSection', 'Add First Section')}</button>
          </div>
        {/if}
      </div>
    </div>

    <!-- Resizable Divider Handle (Only active when open) -->
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
      class="sidebar-resizer"
      class:resizing={isResizing}
      onmousedown={startResizing}
      role="separator"
      aria-orientation="vertical"
      aria-valuenow={sidebarWidth}
      title={t('sidebar.resizerTooltip', 'Drag horizontally to resize sidebar')}
    ></div>
  {/if}
</aside>

<!-- Section Delete Confirmation Modal -->
{#if sectionPendingDelete}
  <div class="confirm-backdrop" onclick={cancelDelete} aria-hidden="true"></div>
  <div class="confirm-modal" role="dialog" aria-modal="true">
    <div class="confirm-header">
      <div class="confirm-icon-wrap">⚠️</div>
      <h3 class="confirm-title">{t('sidebar.deleteConfirmTitle', 'Delete Section?')}</h3>
    </div>
    <p class="confirm-body">
      {t('sidebar.deleteConfirmBody', 'Are you sure you want to delete "{title}"? All written Markdown content in this section will be permanently removed.').replace('{title}', sectionPendingDelete.title)}
    </p>
    <div class="confirm-actions">
      <button type="button" class="btn-cancel" onclick={cancelDelete}>{t('common.cancel', 'Cancel')}</button>
      <button type="button" class="btn-delete-confirm" onclick={confirmDelete}>{t('sidebar.deleteSection', 'Delete Section')}</button>
    </div>
  </div>
{/if}

<style>
  .dokai-sidebar {
    height: 100%;
    background-color: var(--sidebar-bg);
    border-right: 1px solid var(--border-color);
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    user-select: none;
    position: relative;
    z-index: 50;
    overflow: hidden;
    transition: width 0.2s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.2s ease, border-color 0.2s ease;
  }

  .dokai-sidebar.resizing {
    transition: none !important;
  }

  .dokai-sidebar.closed {
    width: 0 !important;
    min-width: 0 !important;
    border-right: none !important;
    overflow: hidden !important;
    visibility: hidden !important;
    pointer-events: none !important;
  }

  .sidebar-resizer {
    position: absolute;
    top: 0;
    right: -3px;
    width: 6px;
    height: 100%;
    cursor: col-resize;
    z-index: 60;
    transition: background 0.15s ease;
  }

  .sidebar-resizer:hover,
  .sidebar-resizer.resizing {
    background: var(--accent-color);
  }

  .sidebar-header {
    padding: 16px 14px 12px 14px;
    border-bottom: 1px solid var(--border-color);
  }

  .doc-badge-row {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 6px;
  }

  .category-tag {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--accent-color);
    background: var(--badge-bg);
    padding: 2px 7px;
    border-radius: 4px;
  }

  .version-tag {
    font-size: 11px;
    color: var(--text-secondary);
    background: var(--bg-hover);
    padding: 2px 6px;
    border-radius: 4px;
  }

  .author-tag {
    font-size: 11px;
    color: var(--text-primary);
    background: rgba(16, 185, 129, 0.12);
    border: 1px solid rgba(16, 185, 129, 0.25);
    padding: 2px 7px;
    border-radius: 4px;
    font-weight: 500;
    max-width: 140px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .doc-title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .doc-title {
    font-size: 15px;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0;
    line-height: 1.3;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .edit-meta-btn {
    width: 24px;
    height: 24px;
    border-radius: 4px;
    border: none;
    background: transparent;
    color: var(--text-secondary);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    flex-shrink: 0;
  }

  .edit-meta-btn:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .doc-desc {
    font-size: 12px;
    color: var(--text-secondary);
    margin: 6px 0 0 0;
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .no-doc-placeholder {
    font-size: 13px;
    color: var(--text-secondary);
  }

  .search-box-wrapper {
    padding: 10px 14px;
    border-bottom: 1px solid var(--border-color);
  }

  .search-input-group {
    display: flex;
    align-items: center;
    gap: 8px;
    background: var(--input-bg);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    padding: 0 10px;
    height: 32px;
    transition: border-color 0.15s ease;
  }

  .search-input-group:focus-within {
    border-color: var(--accent-color);
  }

  .search-icon {
    color: var(--text-secondary);
    flex-shrink: 0;
  }

  .search-input {
    width: 100%;
    background: transparent;
    border: none;
    outline: none;
    font-size: 12.5px;
    color: var(--text-primary);
  }

  .search-input::placeholder {
    color: var(--text-secondary);
    opacity: 0.7;
  }

  .clear-search-btn {
    background: transparent;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    font-size: 11px;
    padding: 0;
  }

  .sections-scroll-area {
    flex: 1;
    overflow-y: auto;
    padding: 12px 8px;
  }

  .sections-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 6px 8px 6px;
  }

  .sections-heading-label {
    font-size: 11px;
    font-weight: 700;
    color: var(--text-secondary);
    letter-spacing: 0.6px;
  }

  .add-section-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11.5px;
    font-weight: 600;
    color: var(--accent-color);
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 4px;
    transition: background 0.15s ease;
  }

  .add-section-btn:hover {
    background: var(--badge-bg);
  }

  .sections-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .section-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 7px 8px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    color: var(--text-secondary);
    transition: all 0.15s ease;
    position: relative;
  }

  .section-item:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .section-item.active {
    background: var(--accent-subtle);
    color: var(--accent-color);
    font-weight: 600;
  }

  .section-main {
    display: flex;
    align-items: center;
    gap: 8px;
    overflow: hidden;
    flex: 1;
  }

  .section-order-num {
    font-size: 11px;
    font-family: monospace;
    opacity: 0.6;
    width: 14px;
    text-align: right;
    flex-shrink: 0;
  }

  .section-title-text {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .rename-input {
    background: var(--input-bg);
    border: 1px solid var(--accent-color);
    border-radius: 4px;
    font-size: 12.5px;
    padding: 2px 6px;
    color: var(--text-primary);
    width: 100%;
    outline: none;
  }

  .section-actions {
    display: none;
    align-items: center;
    gap: 2px;
    flex-shrink: 0;
  }

  .section-item:hover .section-actions {
    display: flex;
  }

  .sec-act-btn {
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: 3px;
    font-size: 10px;
    color: var(--text-secondary);
    cursor: pointer;
    transition: background 0.1s ease, color 0.1s ease;
  }

  .sec-act-btn:hover {
    background: var(--bg-surface);
    color: var(--text-primary);
  }

  .sec-act-btn.delete:hover {
    background: rgba(239, 68, 68, 0.15);
    color: #ef4444;
  }

  /* Table of Contents - Multi-level indentations */
  .section-toc-list {
    margin: 2px 0 6px 20px;
    padding-left: 6px;
    border-left: 1.5px solid var(--border-color);
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .toc-item {
    display: flex;
    align-items: center;
    gap: 6px;
    background: transparent;
    border: none;
    text-align: left;
    font-size: 12px;
    color: var(--text-secondary);
    cursor: pointer;
    padding: 3px 6px;
    border-radius: 4px;
    transition: color 0.15s ease, background 0.15s ease;
  }

  .toc-item:hover {
    color: var(--accent-color);
    background: var(--bg-hover);
  }

  .toc-item.level-1 { padding-left: 2px; font-weight: 600; }
  .toc-item.level-2 { padding-left: 6px; }
  .toc-item.level-3 { padding-left: 12px; font-size: 11.5px; opacity: 0.9; }
  .toc-item.level-4 { padding-left: 18px; font-size: 11px; opacity: 0.85; }
  .toc-item.level-5 { padding-left: 24px; font-size: 10.5px; opacity: 0.8; }
  .toc-item.level-6 { padding-left: 30px; font-size: 10px; opacity: 0.75; }

  .toc-bullet {
    font-size: 11px;
    opacity: 0.6;
    letter-spacing: -1px;
  }

  .toc-text {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .empty-state {
    text-align: center;
    padding: 20px 10px;
    font-size: 12px;
    color: var(--text-secondary);
  }

  /* Delete Confirmation Modal */
  .confirm-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.65);
    backdrop-filter: blur(3px);
    z-index: 1000;
  }

  .confirm-modal {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 90%;
    max-width: 400px;
    background: var(--bg-surface);
    border: 1px solid var(--border-color);
    border-radius: 10px;
    box-shadow: 0 15px 40px rgba(0, 0, 0, 0.45);
    padding: 20px;
    z-index: 1001;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .confirm-header {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .confirm-icon-wrap {
    font-size: 20px;
  }

  .confirm-title {
    margin: 0;
    font-size: 16px;
    font-weight: 700;
    color: var(--text-primary);
  }

  .confirm-body {
    margin: 0;
    font-size: 13px;
    line-height: 1.5;
    color: var(--text-secondary);
  }

  .confirm-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 6px;
  }

  .btn-cancel {
    padding: 7px 14px;
    border-radius: 6px;
    background: var(--btn-bg);
    border: 1px solid var(--border-color);
    color: var(--text-secondary);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
  }

  .btn-cancel:hover {
    background: var(--btn-hover-bg);
    color: var(--text-primary);
  }

  .btn-delete-confirm {
    padding: 7px 14px;
    border-radius: 6px;
    background: #ef4444;
    border: none;
    color: #ffffff;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
  }

  .btn-delete-confirm:hover {
    background: #dc2626;
  }

  @media (max-width: 768px) {
    .dokai-sidebar {
      position: fixed;
      top: 44px;
      left: 0;
      bottom: 0;
      transform: translateX(-100%);
      box-shadow: 4px 0 20px rgba(0, 0, 0, 0.3);
      transition: transform 0.25s ease;
    }

    .dokai-sidebar.open {
      transform: translateX(0);
    }

    .sidebar-resizer {
      display: none;
    }

    .sidebar-backdrop {
      position: fixed;
      top: 44px;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 45;
      backdrop-filter: blur(2px);
    }
  }
</style>
