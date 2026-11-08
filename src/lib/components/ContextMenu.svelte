<script lang="ts">
  import { onMount } from 'svelte';
  import { t } from '../i18n/index.svelte';

  interface Props {
    onNewDoc?: () => void;
    onOpenSearch?: () => void;
    onOpenAiModal?: () => void;
    onOpenSettings?: () => void;
    onEnhance?: () => void;
  }

  let {
    onNewDoc,
    onOpenSearch,
    onOpenAiModal,
    onOpenSettings,
    onEnhance
  }: Props = $props();

  let visible = $state(false);
  let x = $state(0);
  let y = $state(0);

  let targetIsEditable = $state(false);
  let targetHasSelection = $state(false);
  let isEditorTextarea = $state(false);
  let activeTarget = $state<HTMLElement | null>(null);

  function handleContextMenu(e: MouseEvent) {
    // Prevent the default browser context menu (Back, Forward, Reload, Print, Inspect)
    e.preventDefault();

    const target = e.target as HTMLElement | null;
    activeTarget = target;

    const isInput =
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      (target && target.isContentEditable);

    targetIsEditable = !!isInput;
    isEditorTextarea = !!(target instanceof HTMLTextAreaElement);

    let hasSel = false;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
      hasSel = (target.selectionEnd || 0) > (target.selectionStart || 0);
    } else {
      hasSel = (window.getSelection()?.toString().length ?? 0) > 0;
    }
    targetHasSelection = hasSel;

    // Viewport boundary guard
    const menuWidth = 220;
    const menuHeight = 260;
    let posX = e.clientX;
    let posY = e.clientY;

    if (posX + menuWidth > window.innerWidth) {
      posX = Math.max(10, window.innerWidth - menuWidth - 10);
    }
    if (posY + menuHeight > window.innerHeight) {
      posY = Math.max(10, window.innerHeight - menuHeight - 10);
    }

    x = posX;
    y = posY;
    visible = true;
  }

  function closeMenu() {
    visible = false;
    activeTarget = null;
  }

  async function doCut() {
    if (activeTarget && (activeTarget instanceof HTMLTextAreaElement || activeTarget instanceof HTMLInputElement)) {
      const start = activeTarget.selectionStart || 0;
      const end = activeTarget.selectionEnd || 0;
      const val = activeTarget.value;
      const selected = val.substring(start, end);
      if (selected) {
        await navigator.clipboard.writeText(selected).catch(() => {});
        activeTarget.value = val.substring(0, start) + val.substring(end);
        activeTarget.selectionStart = activeTarget.selectionEnd = start;
        activeTarget.dispatchEvent(new Event('input', { bubbles: true }));
        activeTarget.focus();
      }
    }
    closeMenu();
  }

  async function doCopy() {
    let textToCopy = '';
    if (activeTarget && (activeTarget instanceof HTMLTextAreaElement || activeTarget instanceof HTMLInputElement)) {
      const start = activeTarget.selectionStart || 0;
      const end = activeTarget.selectionEnd || 0;
      textToCopy = activeTarget.value.substring(start, end);
    } else {
      textToCopy = window.getSelection()?.toString() || '';
    }
    if (textToCopy) {
      await navigator.clipboard.writeText(textToCopy).catch(() => {});
    }
    closeMenu();
  }

  async function doPaste() {
    try {
      const text = await navigator.clipboard.readText();
      if (activeTarget && (activeTarget instanceof HTMLTextAreaElement || activeTarget instanceof HTMLInputElement)) {
        const start = activeTarget.selectionStart || 0;
        const end = activeTarget.selectionEnd || 0;
        const val = activeTarget.value;
        activeTarget.value = val.substring(0, start) + text + val.substring(end);
        activeTarget.selectionStart = activeTarget.selectionEnd = start + text.length;
        activeTarget.dispatchEvent(new Event('input', { bubbles: true }));
        activeTarget.focus();
      }
    } catch (err) {
      console.warn('Paste failed:', err);
    }
    closeMenu();
  }

  function doSelectAll() {
    if (activeTarget && (activeTarget instanceof HTMLTextAreaElement || activeTarget instanceof HTMLInputElement)) {
      activeTarget.select();
      activeTarget.focus();
    } else {
      window.getSelection()?.selectAllChildren(document.body);
    }
    closeMenu();
  }

  function handleAction(fn?: () => void) {
    closeMenu();
    if (fn) fn();
  }

  onMount(() => {
    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('click', closeMenu);
    window.addEventListener('scroll', closeMenu, true);

    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeMenu();
    }
    window.addEventListener('keydown', handleKey);

    return () => {
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('click', closeMenu);
      window.removeEventListener('scroll', closeMenu, true);
      window.removeEventListener('keydown', handleKey);
    };
  });
</script>

{#if visible}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="dokai-context-menu"
    style="left: {x}px; top: {y}px;"
    onclick={(e) => e.stopPropagation()}
  >
    {#if targetIsEditable}
      <button type="button" class="menu-item" disabled={!targetHasSelection} onclick={doCut}>
        <span class="item-icon">✂️</span>
        <span class="item-label">{t('contextMenu.cut', 'Cut')}</span>
        <span class="item-shortcut">Ctrl+X</span>
      </button>

      <button type="button" class="menu-item" disabled={!targetHasSelection} onclick={doCopy}>
        <span class="item-icon">📋</span>
        <span class="item-label">{t('contextMenu.copy', 'Copy')}</span>
        <span class="item-shortcut">Ctrl+C</span>
      </button>

      <button type="button" class="menu-item" onclick={doPaste}>
        <span class="item-icon">📥</span>
        <span class="item-label">{t('contextMenu.paste', 'Paste')}</span>
        <span class="item-shortcut">Ctrl+V</span>
      </button>

      <button type="button" class="menu-item" onclick={doSelectAll}>
        <span class="item-icon">🔤</span>
        <span class="item-label">{t('contextMenu.selectAll', 'Select All')}</span>
        <span class="item-shortcut">Ctrl+A</span>
      </button>

      {#if isEditorTextarea}
        <div class="menu-divider"></div>
        <button type="button" class="menu-item highlight" onclick={() => handleAction(onEnhance)}>
          <span class="item-icon">✨</span>
          <span class="item-label">{t('contextMenu.enhanceWithAi', 'Enhance Section with AI')}</span>
        </button>
      {/if}
    {:else if targetHasSelection}
      <button type="button" class="menu-item" onclick={doCopy}>
        <span class="item-icon">📋</span>
        <span class="item-label">{t('contextMenu.copySelection', 'Copy Selection')}</span>
        <span class="item-shortcut">Ctrl+C</span>
      </button>
      <div class="menu-divider"></div>
      <button type="button" class="menu-item" onclick={() => handleAction(onOpenSearch)}>
        <span class="item-icon">🔍</span>
        <span class="item-label">{t('contextMenu.searchInDokai', 'Search in DokAI')}</span>
        <span class="item-shortcut">Ctrl+K</span>
      </button>
    {:else}
      <button type="button" class="menu-item" onclick={() => handleAction(onNewDoc)}>
        <span class="item-icon">➕</span>
        <span class="item-label">{t('contextMenu.newDoc', 'New Document')}</span>
        <span class="item-shortcut">Ctrl+N</span>
      </button>

      <button type="button" class="menu-item" onclick={() => handleAction(onOpenSearch)}>
        <span class="item-icon">🔍</span>
        <span class="item-label">{t('contextMenu.commandPalette', 'Command Palette')}</span>
        <span class="item-shortcut">Ctrl+K</span>
      </button>

      <button type="button" class="menu-item" onclick={() => handleAction(onOpenAiModal)}>
        <span class="item-icon">✨</span>
        <span class="item-label">{t('contextMenu.aiGenerator', 'AI Documentation Generator')}</span>
      </button>

      <div class="menu-divider"></div>

      <button type="button" class="menu-item" onclick={() => handleAction(onOpenSettings)}>
        <span class="item-icon">⚙️</span>
        <span class="item-label">{t('contextMenu.preferences', 'Preferences & Settings')}</span>
      </button>
    {/if}
  </div>
{/if}

<style>
  .dokai-context-menu {
    position: fixed;
    z-index: 99999;
    min-width: 200px;
    background: var(--bg-surface, #0a0a0a);
    border: 1px solid var(--border-color, #222222);
    border-radius: 8px;
    padding: 5px;
    box-shadow: 0 10px 28px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(255, 255, 255, 0.05);
    display: flex;
    flex-direction: column;
    gap: 2px;
    user-select: none;
    animation: fadeIn 0.1s ease-out;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: scale(0.96);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  .menu-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 6px 10px;
    background: transparent;
    border: none;
    border-radius: 5px;
    color: var(--text-primary, #ededed);
    font-size: 12px;
    font-family: inherit;
    text-align: left;
    cursor: pointer;
    transition: background 0.1s ease, color 0.1s ease;
  }

  .menu-item:hover:not(:disabled) {
    background: var(--btn-hover-bg, #1a1a1a);
    color: #ffffff;
  }

  .menu-item.highlight:hover {
    background: rgba(99, 102, 241, 0.2);
    color: var(--accent-color, #6366f1);
  }

  .menu-item:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .item-icon {
    font-size: 13px;
    width: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .item-label {
    flex: 1;
    white-space: nowrap;
  }

  .item-shortcut {
    font-size: 10px;
    color: var(--text-secondary, #777);
    margin-left: 12px;
  }

  .menu-divider {
    height: 1px;
    background: var(--border-color, #1f1f1f);
    margin: 4px 2px;
  }
</style>
