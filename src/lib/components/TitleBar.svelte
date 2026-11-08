<script lang="ts">
  import { onMount } from 'svelte';
  import type { TabItem } from '../types';
  import { t } from '$lib/i18n/index.svelte';
  import { aiTaskState, cancelAiTask, removeAiTask, type AiTaskKind } from '$lib/ai/aiTaskManager.svelte';

  interface Props {
    tabs: TabItem[];
    activeTabId: string;
    isDocsBarOpen?: boolean;
    onSelectTab: (docId: string) => void;
    onCloseTab: (docId: string) => void;
    onNewTabClick: () => void;
    onReorderTabs?: (fromIndex: number, toIndex: number) => void;
    onOpenAiModal: () => void;
    onOpenImportExport: () => void;
    onToggleDocsBar: () => void;
    onOpenSettings: () => void;
    onOpenCommandPalette?: () => void;
    onBeforeClose?: () => void | Promise<void>;
  }

  let {
    tabs,
    activeTabId,
    isDocsBarOpen = true,
    onSelectTab,
    onCloseTab,
    onNewTabClick,
    onReorderTabs,
    onOpenAiModal,
    onOpenImportExport,
    onToggleDocsBar,
    onOpenSettings,
    onOpenCommandPalette,
    onBeforeClose
  }: Props = $props();

  let scrollContainer = $state<HTMLDivElement | null>(null);
  let canScrollLeft = $state(false);
  let canScrollRight = $state(false);
  let isTasksMenuOpen = $state(false);

  let runningTaskCount = $derived(aiTaskState.tasks.filter((task) => task.status === 'running').length);
  let totalTaskCount = $derived(aiTaskState.tasks.length);

  function getTaskKindIcon(kind: AiTaskKind): string {
    switch (kind) {
      case 'generate':
        return '✨';
      case 'enhance-section':
        return '🎯';
      case 'enhance-doc':
        return '🚀';
      case 'audit':
        return '🔍';
    }
  }

  // Robust Pointer-based X-axis Tab Reordering
  let isDraggingTab = $state(false);
  let dragSourceIndex = $state<number | null>(null);
  let dragTargetIndex = $state<number | null>(null);
  let dragOffsetX = $state(0);
  let draggedTabWidth = $state(150);

  function getTabShiftStyle(index: number): string {
    if (!isDraggingTab || dragSourceIndex === null || dragTargetIndex === null) return '';
    if (index === dragSourceIndex) {
      return `transform: translateX(${dragOffsetX}px); z-index: 40; pointer-events: none;`;
    }
    const shift = draggedTabWidth + 4;
    if (dragSourceIndex < dragTargetIndex && index > dragSourceIndex && index <= dragTargetIndex) {
      return `transform: translateX(-${shift}px); transition: transform 0.16s cubic-bezier(0.2, 0, 0, 1);`;
    }
    if (dragSourceIndex > dragTargetIndex && index < dragSourceIndex && index >= dragTargetIndex) {
      return `transform: translateX(${shift}px); transition: transform 0.16s cubic-bezier(0.2, 0, 0, 1);`;
    }
    return 'transition: transform 0.16s cubic-bezier(0.2, 0, 0, 1);';
  }

  function checkScrollability() {
    if (!scrollContainer) return;
    canScrollLeft = scrollContainer.scrollLeft > 2;
    canScrollRight =
      scrollContainer.scrollLeft < scrollContainer.scrollWidth - scrollContainer.clientWidth - 2;
  }

  function scrollTabs(direction: 'left' | 'right') {
    if (!scrollContainer) return;
    const distance = 180;
    scrollContainer.scrollBy({
      left: direction === 'left' ? -distance : distance,
      behavior: 'smooth'
    });
    setTimeout(checkScrollability, 200);
  }

  function handleWheel(e: WheelEvent) {
    if (!scrollContainer) return;
    if (e.deltaY !== 0) {
      e.preventDefault();
      scrollContainer.scrollLeft += e.deltaY;
      checkScrollability();
    }
  }

  $effect(() => {
    if (tabs) {
      setTimeout(checkScrollability, 50);
    }
  });

  onMount(() => {
    checkScrollability();
    window.addEventListener('resize', checkScrollability);
    return () => window.removeEventListener('resize', checkScrollability);
  });

  // Pointer-Driven X-Axis Tab Dragging (Works symmetrically left-to-right and right-to-left)
  function startTabPointerDown(e: PointerEvent, index: number, docId: string) {
    // Middle click closes tab
    if (e.button === 1) {
      if (tabs.length > 1) {
        e.preventDefault();
        e.stopPropagation();
        onCloseTab(docId);
      }
      return;
    }
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('.tab-close-btn')) return;

    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const originIndex = index;
    let moved = false;

    // Snapshot initial untransformed bounding rects of all tabs before any translateX is applied
    const initialRects: Array<{ left: number; right: number; center: number; width: number }> = [];
    if (scrollContainer) {
      const tabElements = Array.from(scrollContainer.querySelectorAll('.chrome-tab'));
      for (const el of tabElements) {
        const r = el.getBoundingClientRect();
        initialRects.push({
          left: r.left,
          right: r.right,
          center: r.left + r.width / 2,
          width: r.width
        });
      }
    }

    draggedTabWidth = initialRects[originIndex]?.width || 150;
    dragSourceIndex = originIndex;
    dragTargetIndex = originIndex;
    dragOffsetX = 0;

    function onPointerMove(moveEvent: PointerEvent) {
      const deltaX = moveEvent.clientX - startX;
      if (!moved && Math.abs(deltaX) > 4) {
        moved = true;
        isDraggingTab = true;
      }

      if (moved && initialRects.length > 0) {
        dragOffsetX = deltaX;
        const pointerX = moveEvent.clientX;
        const draggedCenterX = (initialRects[originIndex]?.center ?? startX) + deltaX;

        let targetIdx = originIndex;

        if (deltaX > 0) {
          // Dragging left -> right: advance target index whenever pointer or dragged tab center crosses a tab's center
          for (let i = originIndex + 1; i < initialRects.length; i++) {
            const slot = initialRects[i];
            if (pointerX >= slot.left + slot.width * 0.35 || draggedCenterX >= slot.center) {
              targetIdx = i;
            } else {
              break;
            }
          }
        } else if (deltaX < 0) {
          // Dragging right -> left: move target index left whenever pointer or dragged tab center crosses a tab's center
          for (let i = originIndex - 1; i >= 0; i--) {
            const slot = initialRects[i];
            if (pointerX <= slot.right - slot.width * 0.35 || draggedCenterX <= slot.center) {
              targetIdx = i;
            } else {
              break;
            }
          }
        }

        dragTargetIndex = targetIdx;
      }
    }

    function onPointerUp() {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);

      if (moved && dragSourceIndex !== null && dragTargetIndex !== null && dragSourceIndex !== dragTargetIndex) {
        onReorderTabs?.(dragSourceIndex, dragTargetIndex);
      } else if (!moved) {
        onSelectTab(docId);
      }

      isDraggingTab = false;
      dragSourceIndex = null;
      dragTargetIndex = null;
      dragOffsetX = 0;
    }

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  }

  // Desktop Window Controls
  async function handleTitlebarMouseDown(e: MouseEvent) {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (
      target.closest('button') ||
      target.closest('input') ||
      target.closest('a') ||
      target.closest('.chrome-tab') ||
      target.closest('.scroll-arrow-btn')
    ) {
      return;
    }

    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const win = getCurrentWindow();
      if (win && typeof win.startDragging === 'function') {
        await win.startDragging();
      }
    } catch {
      // Browser preview fallback
    }
  }

  async function minimizeWindow() {
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const win = getCurrentWindow();
      if (win) await win.minimize();
    } catch (err) {
      console.warn('Minimize not available in web context:', err);
    }
  }

  async function toggleMaximizeWindow() {
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const win = getCurrentWindow();
      if (win) await win.toggleMaximize();
    } catch (err) {
      console.warn('Maximize not available in web context:', err);
    }
  }

  async function closeWindow() {
    try {
      if (onBeforeClose) {
        await onBeforeClose();
      }
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const win = getCurrentWindow();
      if (win) await win.close();
    } catch (err) {
      console.warn('Close not available in web context:', err);
    }
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<header
  class="titlebar"
  data-tauri-drag-region
  onmousedown={handleTitlebarMouseDown}
>
  <!-- Brand Zone -->
  <div class="brand-zone" data-tauri-drag-region>
    <img src="/dokai_logo.svg" alt="DokAI Logo" class="app-icon" />
    <span class="brand-name">DokAI</span>
    <span class="brand-badge">Docs</span>
  </div>

  <!-- Tabs Outer Strip (Confined to available space before action zone) -->
  <div class="tabs-outer-wrapper" data-tauri-drag-region>
    <!-- Scroll Left Arrow Button -->
    {#if canScrollLeft}
      <button
        class="scroll-arrow-btn left"
        onclick={() => scrollTabs('left')}
        title={t('titlebar.scrollLeft', 'Scroll tabs left')}
      >
        ‹
      </button>
    {/if}

    <!-- Tabs Scroll Track -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="tabs-scroll-container"
      bind:this={scrollContainer}
      onscroll={checkScrollability}
      onwheel={handleWheel}
      data-tauri-drag-region
    >
      {#each tabs as tab, index (tab.docId)}
        <div
          class="chrome-tab"
          class:active={tab.docId === activeTabId}
          class:is-dragging={isDraggingTab && dragSourceIndex === index}
          class:drag-target-left={isDraggingTab && dragTargetIndex === index && dragSourceIndex !== null && dragSourceIndex > index}
          class:drag-target-right={isDraggingTab && dragTargetIndex === index && dragSourceIndex !== null && dragSourceIndex < index}
          style={getTabShiftStyle(index)}
          onpointerdown={(e) => startTabPointerDown(e, index, tab.docId)}
          role="tab"
          aria-selected={tab.docId === activeTabId}
          tabindex="0"
          onkeydown={(e) => e.key === 'Enter' && onSelectTab(tab.docId)}
        >
          <div class="tab-content">
            <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
            <span class="tab-title" title={tab.title}>{tab.title || 'Untitled Doc'}</span>
            
            {#if tabs.length > 1}
              <button
                class="tab-close-btn"
                title={t('titlebar.closeTab', 'Close Tab')}
                onclick={(e) => {
                  e.stopPropagation();
                  onCloseTab(tab.docId);
                }}
              >
                <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            {/if}
          </div>
        </div>
      {/each}

      <!-- New Tab Button embedded inside the scroll track (Directly opens manual New Document Modal) -->
      <button
        class="new-tab-btn"
        onclick={(e) => {
          e.stopPropagation();
          onNewTabClick();
        }}
        title={t('titlebar.newManualDoc', 'Create New Document Manually')}
      >
        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
      </button>
    </div>

    <!-- Scroll Right Arrow Button -->
    {#if canScrollRight}
      <button
        class="scroll-arrow-btn right"
        onclick={() => scrollTabs('right')}
        title={t('titlebar.scrollRight', 'Scroll tabs right')}
      >
        ›
      </button>
    {/if}
  </div>

  <!-- Right Actions Toolbar (Guaranteed fixed position, never overlapped) -->
  <div class="actions-zone" onmousedown={(e) => e.stopPropagation()}>
    {#if onOpenCommandPalette}
      <button
        class="action-btn search-palette-btn"
        onclick={onOpenCommandPalette}
        title={t('titlebar.searchTooltip', 'Quick Search & Command Palette (Ctrl+K)')}
      >
        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <span class="btn-label">{t('titlebar.search')}</span>
        <kbd class="shortcut-kbd">Ctrl+K</kbd>
      </button>
    {/if}

    <!-- AI Tasks Queue Button (Right next to Search bar) -->
    <div class="tasks-menu-wrapper">
      <button
        type="button"
        class="action-btn tasks-queue-btn"
        class:has-running={runningTaskCount > 0}
        class:menu-open={isTasksMenuOpen}
        onclick={() => (isTasksMenuOpen = !isTasksMenuOpen)}
        title={t('titlebar.tasksTooltip', 'AI Background Tasks Queue')}
      >
        {#if runningTaskCount > 0}
          <span class="tasks-btn-spinner"></span>
        {:else}
          <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
            <polyline points="9 11 12 14 22 4"></polyline>
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
          </svg>
        {/if}
        <span class="btn-label">{t('titlebar.tasks', 'Tasks')}</span>
        {#if totalTaskCount > 0}
          <span class="tasks-count-badge" class:active-badge={runningTaskCount > 0}>
            {totalTaskCount}
          </span>
        {/if}
      </button>

      {#if isTasksMenuOpen}
        <!-- Backdrop to close Tasks popover when clicking outside -->
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="tasks-outside-backdrop" onclick={() => (isTasksMenuOpen = false)}></div>

        <div class="tasks-dropdown-panel" role="region" aria-label="AI Tasks Queue">
          <div class="tasks-panel-header">
            <div class="tp-title-row">
              <span class="tp-title">⚡ {t('titlebar.tasksHeader', 'AI Tasks Queue')}</span>
              <span class="tp-sub">
                {#if runningTaskCount > 0}
                  {runningTaskCount} {t('titlebar.running', 'running')}
                {:else}
                  {totalTaskCount} {t('titlebar.total', 'total')}
                {/if}
              </span>
            </div>
            <button type="button" class="tp-close-btn" onclick={() => (isTasksMenuOpen = false)}>✕</button>
          </div>

          <div class="tasks-panel-list">
            {#if aiTaskState.tasks.length > 0}
              {#each aiTaskState.tasks as task, i (task.id)}
                <div class="task-row-card status-{task.status}">
                  <div class="task-row-top">
                    <div class="task-row-title-wrap">
                      <span class="task-seq-num">#{i + 1}</span>
                      <span class="task-kind-icon">{getTaskKindIcon(task.kind)}</span>
                      <span class="task-row-title" title={task.title}>{task.title}</span>
                    </div>

                    <div class="task-row-right">
                      {#if task.status === 'running'}
                        <span class="task-pct-badge">{Math.round(task.progress)}%</span>
                        <button
                          type="button"
                          class="task-cancel-btn"
                          onclick={() => cancelAiTask(task.id)}
                          title={t('editor.cancelTask', 'Cancel Task')}
                        >
                          ✕ {t('editor.cancelTask', 'Cancel')}
                        </button>
                      {:else if task.status === 'completed'}
                        <span class="task-done-badge">✓ {t('titlebar.taskDone', 'Completed')} (15s)</span>
                        <button
                          type="button"
                          class="task-dismiss-icon"
                          onclick={() => removeAiTask(task.id)}
                          title={t('titlebar.removeFromList', 'Remove from list')}
                        >
                          ✕
                        </button>
                      {:else if task.status === 'error'}
                        <span class="task-err-badge">⚠️ {t('titlebar.taskError', 'Error')}</span>
                        <button
                          type="button"
                          class="task-dismiss-icon"
                          onclick={() => removeAiTask(task.id)}
                          title={t('titlebar.removeFromList', 'Remove from list')}
                        >
                          ✕
                        </button>
                      {/if}
                    </div>
                  </div>

                  <div class="task-step-line">{task.stepText}</div>

                  <div class="task-progress-track">
                    <div
                      class="task-progress-fill fill-{task.status}"
                      style="width: {Math.round(task.progress)}%"
                    ></div>
                  </div>
                </div>
              {/each}
            {:else}
              <div class="tasks-empty-state">
                <span class="empty-tasks-icon">✓</span>
                <p>{t('titlebar.noActiveTasks', 'No active AI tasks right now.')}</p>
                <span class="empty-tasks-sub">
                  {t('titlebar.tasksHint', 'You can start multiple AI tasks concurrently; completed tasks clear automatically after 15s.')}
                </span>
              </div>
            {/if}
          </div>
        </div>
      {/if}
    </div>

    <!-- AI Generator Button -->
    <button class="action-btn ai-sparkle-btn" onclick={onOpenAiModal} title={t('titlebar.aiGenerator')}>
      <svg class="sparkle-icon" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2L14.4 7.6L20 10L14.4 12.4L12 18L9.6 12.4L4 10L9.6 7.6L12 2Z" />
      </svg>
      <span class="btn-label">{t('titlebar.aiGenerator')}</span>
    </button>

    <!-- Toggle Documents Explorer Bar Button -->
    <button
      class="action-btn icon-only-btn"
      class:active-bar-btn={isDocsBarOpen}
      onclick={onToggleDocsBar}
      title={t('titlebar.toggleDocsBar', 'Toggle Documents Bar')}
    >
      <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
      </svg>
    </button>

    <!-- JSON Import / Export Button -->
    <button class="action-btn icon-only-btn" onclick={onOpenImportExport} title={t('titlebar.importExport', 'Import / Export JSON & Backup')}>
      <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="7 10 12 15 17 10"></polyline>
        <line x1="12" y1="15" x2="12" y2="3"></line>
      </svg>
    </button>

    <!-- Settings Button -->
    <button class="action-btn icon-only-btn" onclick={onOpenSettings} title={t('titlebar.settingsTooltip', 'Settings & AI Model Providers')}>
      <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none">
        <circle cx="12" cy="12" r="3"></circle>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
      </svg>
    </button>

    <!-- Desktop Window Controls -->
    <div class="window-controls" onmousedown={(e) => e.stopPropagation()}>
      <button class="win-btn minimize" onclick={minimizeWindow} title={t('titlebar.minimize', 'Minimize')}>
        <svg viewBox="0 0 12 12" width="10" height="10">
          <line x1="1" y1="6" x2="11" y2="6" stroke="currentColor" stroke-width="1.2" />
        </svg>
      </button>
      <button class="win-btn maximize" onclick={toggleMaximizeWindow} title={t('titlebar.maximize', 'Maximize / Restore')}>
        <svg viewBox="0 0 12 12" width="10" height="10">
          <rect x="2" y="2" width="8" height="8" fill="none" stroke="currentColor" stroke-width="1.2" />
        </svg>
      </button>
      <button class="win-btn close" onclick={closeWindow} title={t('titlebar.closeWindow', 'Close Window')}>
        <svg viewBox="0 0 12 12" width="10" height="10">
          <line x1="2" y1="2" x2="10" y2="10" stroke="currentColor" stroke-width="1.2" />
          <line x1="10" y1="2" x2="2" y2="10" stroke="currentColor" stroke-width="1.2" />
        </svg>
      </button>
    </div>
  </div>
</header>

<style>
  .titlebar {
    display: flex;
    align-items: center;
    height: 44px;
    box-sizing: border-box;
    overflow: visible;
    background-color: var(--titlebar-bg);
    border-bottom: 1px solid var(--border-color);
    user-select: none;
    position: relative;
    z-index: 120;
    transition: background-color 0.2s ease, border-color 0.2s ease;
    cursor: default;
    -webkit-app-region: drag;
  }

  .titlebar button,
  .chrome-tab,
  .actions-zone,
  .window-controls,
  .new-tab-btn,
  .scroll-arrow-btn {
    -webkit-app-region: no-drag;
  }

  .brand-zone {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 14px 0 12px;
    flex-shrink: 0;
  }

  .app-icon {
    width: 22px;
    height: 22px;
    filter: drop-shadow(0 2px 4px rgba(99, 102, 241, 0.4));
  }

  .brand-name {
    font-weight: 700;
    font-size: 14px;
    letter-spacing: -0.3px;
    background: linear-gradient(135deg, #38bdf8 0%, #818cf8 50%, #c084fc 100%);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .brand-badge {
    font-size: 10px;
    font-weight: 600;
    padding: 1px 5px;
    border-radius: 4px;
    background: var(--badge-bg);
    color: var(--accent-color);
    letter-spacing: 0.2px;
  }

  /* Tabs Outer Wrapper: strictly confined */
  .tabs-outer-wrapper {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: flex-end;
    height: 100%;
    position: relative;
    overflow: hidden;
  }

  .tabs-scroll-container {
    flex: 1;
    display: flex;
    align-items: flex-end;
    gap: 4px;
    height: 100%;
    overflow-x: auto;
    scrollbar-width: none;
    padding: 0 4px;
  }

  .tabs-scroll-container::-webkit-scrollbar {
    display: none;
  }

  /* Scroll Navigation Arrows */
  .scroll-arrow-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 32px;
    margin-bottom: 2px;
    background: var(--btn-bg);
    border: 1px solid var(--border-color);
    color: var(--text-primary);
    font-size: 16px;
    font-weight: bold;
    cursor: pointer;
    z-index: 10;
    opacity: 0.9;
    transition: all 0.15s ease;
  }

  .scroll-arrow-btn.left {
    border-radius: 4px 0 0 4px;
  }

  .scroll-arrow-btn.right {
    border-radius: 0 4px 4px 0;
  }

  .scroll-arrow-btn:hover {
    background: var(--accent-color);
    color: #ffffff;
  }

  /* Chrome Tab */
  .chrome-tab {
    display: flex;
    align-items: center;
    position: relative;
    height: 36px;
    min-width: 130px;
    max-width: 200px;
    padding: 0 10px 0 12px;
    background: transparent;
    border-top-left-radius: 8px;
    border-top-right-radius: 8px;
    color: var(--tab-inactive-text);
    cursor: pointer;
    font-size: 12.5px;
    transition: background 0.15s ease, color 0.15s ease;
    border: 1px solid transparent;
    border-bottom: none;
    flex-shrink: 0;
    touch-action: none;
  }

  .chrome-tab.is-dragging {
    opacity: 0.85;
    background: var(--bg-surface);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.4);
    cursor: grabbing !important;
  }

  .chrome-tab.drag-target-left {
    box-shadow: -3px 0 0 var(--accent-color);
  }

  .chrome-tab.drag-target-right {
    box-shadow: 3px 0 0 var(--accent-color);
  }

  .chrome-tab:hover:not(.active):not(.is-dragging) {
    background: var(--tab-hover-bg);
    color: var(--text-primary);
  }

  .chrome-tab.active {
    background: var(--bg-surface);
    color: var(--text-primary);
    border-color: var(--border-color);
    font-weight: 500;
    box-shadow: 0 -2px 6px rgba(0, 0, 0, 0.05);
  }

  .tab-content {
    display: flex;
    align-items: center;
    gap: 7px;
    width: 100%;
    overflow: hidden;
  }

  .tab-icon {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
    color: var(--accent-color);
    opacity: 0.85;
  }

  .tab-title {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .tab-close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: none;
    background: transparent;
    color: var(--text-secondary);
    cursor: pointer;
    opacity: 0.6;
    transition: all 0.15s ease;
    padding: 0;
    margin-left: 2px;
  }

  .tab-close-btn:hover {
    opacity: 1;
    background: var(--close-hover-bg);
    color: var(--danger-color, #ef4444);
  }

  .new-tab-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border-radius: 6px;
    border: none;
    background: transparent;
    color: var(--text-secondary);
    cursor: pointer;
    margin-bottom: 5px;
    margin-left: 2px;
    flex-shrink: 0;
    transition: background 0.15s ease, color 0.15s ease;
  }

  .new-tab-btn:hover {
    background: var(--tab-hover-bg);
    color: var(--text-primary);
  }

  /* Actions Zone (Always stays in place) */
  .actions-zone {
    display: flex;
    align-items: center;
    height: 100%;
    box-sizing: border-box;
    gap: 6px;
    padding-right: 0;
    padding-left: 8px;
    margin: 0;
    flex-shrink: 0;
    z-index: 20;
    background-color: var(--titlebar-bg);
  }

  .action-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    height: 28px;
    box-sizing: border-box;
    margin: 0;
    border-radius: 6px;
    border: 1px solid var(--border-color);
    background: var(--btn-bg);
    color: var(--text-secondary);
    cursor: pointer;
    font-size: 12px;
    font-weight: 500;
    padding: 0 10px;
    transition: all 0.15s ease;
  }

  .action-btn:hover {
    background: var(--btn-hover-bg);
    color: var(--text-primary);
    border-color: var(--border-hover-color);
  }

  .icon-only-btn {
    padding: 0 7px;
  }

  .action-btn.active-bar-btn {
    border-color: var(--accent-color);
    background: var(--accent-subtle);
    color: var(--accent-color);
  }

  .search-palette-btn {
    gap: 6px;
    padding: 0 8px 0 9px;
  }

  .shortcut-kbd {
    font-size: 10px;
    font-family: inherit;
    padding: 1px 5px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid var(--border-color);
    color: var(--text-secondary);
    line-height: 1.2;
  }

  /* AI Tasks Queue Button & Dropdown Panel */
  .tasks-menu-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }

  .tasks-queue-btn.has-running {
    border-color: rgba(99, 102, 241, 0.5);
    background: rgba(99, 102, 241, 0.14);
    color: #a5b4fc;
  }

  .tasks-queue-btn.menu-open {
    border-color: var(--accent-color);
    color: var(--text-primary);
  }

  .tasks-btn-spinner {
    width: 12px;
    height: 12px;
    border: 1.8px solid #818cf8;
    border-top-color: transparent;
    border-radius: 50%;
    animation: spinTasks 0.75s linear infinite;
    flex-shrink: 0;
  }

  @keyframes spinTasks {
    to {
      transform: rotate(360deg);
    }
  }

  .tasks-count-badge {
    font-size: 10px;
    font-weight: 700;
    padding: 0 5px;
    border-radius: 99px;
    background: rgba(255, 255, 255, 0.1);
    color: var(--text-primary);
  }

  .tasks-count-badge.active-badge {
    background: #6366f1;
    color: #ffffff;
  }

  .tasks-outside-backdrop {
    position: fixed;
    inset: 0;
    z-index: 2500;
    background: transparent;
  }

  .tasks-dropdown-panel {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    width: 390px;
    max-width: calc(100vw - 24px);
    background: var(--bg-surface, #0a0a0a);
    border: 1px solid var(--border-color, #222);
    border-radius: 10px;
    box-shadow: 0 18px 45px rgba(0, 0, 0, 0.7);
    z-index: 2600;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    animation: dropFade 0.15s ease-out;
  }

  @keyframes dropFade {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .tasks-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    background: var(--toolbar-bg, #0c0c0c);
    border-bottom: 1px solid var(--border-color, #222);
  }

  .tp-title-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .tp-title {
    font-size: 12px;
    font-weight: 700;
    color: var(--text-primary);
  }

  .tp-sub {
    font-size: 10.5px;
    font-weight: 600;
    color: var(--accent-color);
    background: var(--accent-subtle);
    padding: 1px 6px;
    border-radius: 99px;
  }

  .tp-close-btn {
    border: none;
    background: transparent;
    color: var(--text-secondary);
    cursor: pointer;
    font-size: 12px;
    padding: 2px 5px;
    border-radius: 4px;
  }

  .tp-close-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    color: var(--text-primary);
  }

  .tasks-panel-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px 12px;
    max-height: 340px;
    overflow-y: auto;
  }

  .task-row-card {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px 12px;
    border-radius: 8px;
    border: 1px solid var(--border-color);
    background: var(--input-bg, #050505);
  }

  .task-row-card.status-running {
    border-color: rgba(99, 102, 241, 0.45);
    background: rgba(99, 102, 241, 0.07);
  }

  .task-row-card.status-completed {
    border-color: rgba(16, 185, 129, 0.4);
    background: rgba(16, 185, 129, 0.07);
  }

  .task-row-card.status-error {
    border-color: rgba(239, 68, 68, 0.4);
    background: rgba(239, 68, 68, 0.07);
  }

  .task-row-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .task-row-title-wrap {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }

  .task-seq-num {
    font-size: 10px;
    font-weight: 700;
    color: var(--text-secondary);
    font-family: 'JetBrains Mono', Consolas, monospace;
    flex-shrink: 0;
  }

  .task-kind-icon {
    font-size: 12px;
    flex-shrink: 0;
  }

  .task-row-title {
    font-size: 12px;
    font-weight: 700;
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .task-row-right {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }

  .task-pct-badge {
    font-size: 11px;
    font-weight: 700;
    color: #a5b4fc;
    font-family: 'JetBrains Mono', Consolas, monospace;
  }

  .task-cancel-btn {
    padding: 2px 7px;
    border-radius: 4px;
    border: 1px solid rgba(239, 68, 68, 0.45);
    background: rgba(239, 68, 68, 0.16);
    color: #f87171;
    font-size: 10px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .task-cancel-btn:hover {
    background: #ef4444;
    color: #ffffff;
  }

  .task-done-badge {
    font-size: 10px;
    font-weight: 700;
    padding: 2px 7px;
    border-radius: 4px;
    background: rgba(16, 185, 129, 0.18);
    color: #34d399;
  }

  .task-err-badge {
    font-size: 10px;
    font-weight: 700;
    padding: 2px 7px;
    border-radius: 4px;
    background: rgba(239, 68, 68, 0.18);
    color: #f87171;
  }

  .task-dismiss-icon {
    border: none;
    background: transparent;
    color: var(--text-secondary);
    font-size: 10px;
    cursor: pointer;
    padding: 2px 4px;
  }

  .task-dismiss-icon:hover {
    color: var(--text-primary);
  }

  .task-step-line {
    font-size: 11px;
    color: var(--text-secondary);
    line-height: 1.35;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .task-progress-track {
    width: 100%;
    height: 5px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 99px;
    overflow: hidden;
  }

  .task-progress-fill {
    height: 100%;
    transition: width 0.25s ease;
  }

  .task-progress-fill.fill-running {
    background: linear-gradient(90deg, #6366f1, #a855f7);
  }

  .task-progress-fill.fill-completed {
    background: #10b981;
  }

  .task-progress-fill.fill-error {
    background: #ef4444;
  }

  .tasks-empty-state {
    padding: 22px 14px;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
  }

  .empty-tasks-icon {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: rgba(16, 185, 129, 0.14);
    color: #10b981;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 13px;
  }

  .tasks-empty-state p {
    margin: 0;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .empty-tasks-sub {
    font-size: 11px;
    color: var(--text-secondary);
    line-height: 1.4;
  }

  .ai-sparkle-btn {
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(168, 85, 247, 0.15) 100%);
    border-color: rgba(129, 140, 248, 0.35);
    color: #818cf8;
    font-weight: 600;
  }

  .ai-sparkle-btn:hover {
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.28) 0%, rgba(168, 85, 247, 0.28) 100%);
    border-color: #818cf8;
    color: #a5b4fc;
    box-shadow: 0 0 10px rgba(99, 102, 241, 0.25);
  }

  .sparkle-icon {
    width: 14px;
    height: 14px;
    color: #a855f7;
    animation: pulse-glow 2.5s infinite ease-in-out;
  }

  @keyframes pulse-glow {
    0%, 100% { opacity: 0.8; transform: scale(1); }
    50% { opacity: 1; transform: scale(1.1); }
  }

  .window-controls {
    display: flex;
    align-items: center;
    height: 100%;
    margin-left: 4px;
    box-sizing: border-box;
  }

  .win-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 100%;
    box-sizing: border-box;
    border: none;
    background: transparent;
    color: var(--text-secondary);
    cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease;
  }

  .win-btn:hover {
    background: var(--tab-hover-bg);
    color: var(--text-primary);
  }

  .win-btn.close:hover {
    background: #e11d48;
    color: #ffffff;
  }

  @media (max-width: 768px) {
    .btn-label {
      display: none;
    }
    .brand-badge {
      display: none;
    }
    .chrome-tab {
      min-width: 90px;
      max-width: 140px;
    }
  }
</style>
