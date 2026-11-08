<script lang="ts">
  import type { Documentation } from '../types';
  import { t } from '../i18n/index.svelte';

  interface Props {
    isOpen: boolean;
    docs: Documentation[];
    onClose: () => void;
    onSelectDocSection: (docId: string, sectionId: string) => void;
    onCreateNewDoc: () => void;
    onOpenAiGenerator: () => void;
    onOpenAiSectionEnhance: () => void;
    onOpenDocAnalysis: () => void;
    onOpenImportExport: () => void;
    onOpenSettings: () => void;
    onToggleSidebar: () => void;
  }

  let {
    isOpen,
    docs,
    onClose,
    onSelectDocSection,
    onCreateNewDoc,
    onOpenAiGenerator,
    onOpenAiSectionEnhance,
    onOpenDocAnalysis,
    onOpenImportExport,
    onOpenSettings,
    onToggleSidebar
  }: Props = $props();

  let searchQuery = $state('');
  let selectedIndex = $state(0);
  let inputEl = $state<HTMLInputElement | null>(null);

  interface PaletteItem {
    id: string;
    kind: 'action' | 'section';
    title: string;
    subtitle: string;
    badge: string;
    run: () => void;
  }

  $effect(() => {
    if (isOpen) {
      searchQuery = '';
      selectedIndex = 0;
      setTimeout(() => {
        inputEl?.focus();
      }, 30);
    }
  });

  let results = $derived.by((): PaletteItem[] => {
    const q = searchQuery.toLowerCase().trim();

    const quickActions: PaletteItem[] = [
      {
        id: 'act-ai-gen',
        kind: 'action',
        title: `✨ ${t('palette.actAiGen', 'AI Documentation Generator')}`,
        subtitle: t('palette.actAiGenDesc', 'Create a complete multi-section technical manual with AI'),
        badge: t('palette.badgeAi', 'AI Command'),
        run: () => {
          onClose();
          onOpenAiGenerator();
        }
      },
      {
        id: 'act-ai-enhance',
        kind: 'action',
        title: `✨ ${t('palette.actAiEnhance', 'Enhance Active Section with AI')}`,
        subtitle: t('palette.actAiEnhanceDesc', 'Expand, refactor, or improve the current section via custom directive'),
        badge: t('palette.badgeAi', 'AI Command'),
        run: () => {
          onClose();
          onOpenAiSectionEnhance();
        }
      },
      {
        id: 'act-ai-audit',
        kind: 'action',
        title: `🔍 ${t('palette.actAiAudit', 'AI Document Audit & Quality Check')}`,
        subtitle: t('palette.actAiAuditDesc', 'Inspect the active document for technical bugs and Markdown issues'),
        badge: t('palette.badgeAi', 'AI Command'),
        run: () => {
          onClose();
          onOpenDocAnalysis();
        }
      },
      {
        id: 'act-new-doc',
        kind: 'action',
        title: `➕ ${t('palette.actNewDoc', 'Create New Blank Document')}`,
        subtitle: t('palette.actNewDocDesc', 'Start a fresh technical specification or guide'),
        badge: t('palette.badgeWorkspace', 'Workspace'),
        run: () => {
          onClose();
          onCreateNewDoc();
        }
      },
      {
        id: 'act-export',
        kind: 'action',
        title: `📤 ${t('palette.actExport', 'Import / Export Documents (JSON, Markdown, HTML)')}`,
        subtitle: t('palette.actExportDesc', 'Export standalone HTML, Markdown, or JSON backups'),
        badge: t('palette.badgeFile', 'File'),
        run: () => {
          onClose();
          onOpenImportExport();
        }
      },
      {
        id: 'act-sidebar',
        kind: 'action',
        title: `◧ ${t('palette.actSidebar', 'Toggle Navigation Sidebar')}`,
        subtitle: t('palette.actSidebarDesc', 'Show or hide the left documentation tree sidebar'),
        badge: t('palette.badgeView', 'View'),
        run: () => {
          onClose();
          onToggleSidebar();
        }
      },
      {
        id: 'act-settings',
        kind: 'action',
        title: `⚙️ ${t('palette.actSettings', 'Open Settings & AI Provider Keys')}`,
        subtitle: t('palette.actSettingsDesc', 'Configure Gemini, Claude, OpenAI, OpenRouter API keys and theme'),
        badge: t('palette.badgeSettings', 'Settings'),
        run: () => {
          onClose();
          onOpenSettings();
        }
      }
    ];

    const tokens = q ? q.split(/\s+/).filter(Boolean) : [];

    const sectionItems: PaletteItem[] = [];
    for (const doc of docs) {
      for (const sec of doc.sections) {
        const contentFlat = (sec.content || '').replace(/[#*`>_~]/g, ' ').replace(/\s+/g, ' ').trim();
        let snippet = contentFlat.slice(0, 110);
        if (tokens.length > 0) {
          const matchedToken = tokens.find((t) => contentFlat.toLowerCase().includes(t));
          if (matchedToken) {
            const matchIdx = contentFlat.toLowerCase().indexOf(matchedToken);
            const start = Math.max(0, matchIdx - 30);
            snippet = (start > 0 ? '...' : '') + contentFlat.slice(start, start + 110) + '...';
          }
        }

        sectionItems.push({
          id: `sec-${doc.id}-${sec.id}`,
          kind: 'section',
          title: `${doc.title}  ›  ${sec.title}`,
          subtitle: snippet || doc.description || 'Documentation section',
          badge: doc.category || 'Doc',
          run: () => {
            onClose();
            onSelectDocSection(doc.id, sec.id);
          }
        });
      }
    }

    if (!q || tokens.length === 0) {
      return [...quickActions, ...sectionItems.slice(0, 12)];
    }

    const filteredActions = quickActions.filter((a) => {
      const combined = `${a.title} ${a.subtitle}`.toLowerCase();
      return tokens.every((tok) => combined.includes(tok));
    });

    const filteredSections = sectionItems.filter((s) => {
      const combined = `${s.title} ${s.subtitle} ${s.badge || ''}`.toLowerCase();
      return tokens.every((tok) => combined.includes(tok));
    });

    return [...filteredActions, ...filteredSections].slice(0, 25);
  });

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (results.length > 0) {
        selectedIndex = (selectedIndex + 1) % results.length;
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (results.length > 0) {
        selectedIndex = (selectedIndex - 1 + results.length) % results.length;
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = results[selectedIndex];
      if (item) {
        item.run();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  }
</script>

{#if isOpen}
  <div class="palette-backdrop" onclick={onClose} aria-hidden="true"></div>

  <div class="palette-modal" role="dialog" aria-modal="true" aria-label="Command Palette and Global Search">
    <div class="search-header">
      <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" class="search-icon">
        <circle cx="11" cy="11" r="8"></circle>
        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
      </svg>
      <input
        bind:this={inputEl}
        type="text"
        bind:value={searchQuery}
        oninput={() => (selectedIndex = 0)}
        onkeydown={handleKeyDown}
        placeholder={t('palette.searchPlaceholder', 'Search across all documents, sections, or run a command...')}
        class="palette-input"
      />
      <kbd class="esc-kbd">ESC</kbd>
    </div>

    <div class="palette-results">
      {#if results.length === 0}
        <div class="empty-results">{t('palette.noResults', 'No matching documents, sections, or commands found.')}</div>
      {:else}
        {#each results as item, idx (item.id)}
          <button
            type="button"
            class="palette-item"
            class:selected={idx === selectedIndex}
            onmouseenter={() => (selectedIndex = idx)}
            onclick={item.run}
          >
            <div class="item-main">
              <span class="item-title">{item.title}</span>
              <span class="item-sub">{item.subtitle}</span>
            </div>
            <span class="item-badge" class:ai-badge={item.badge.includes('AI')}>{item.badge}</span>
          </button>
        {/each}
      {/if}
    </div>

    <div class="palette-footer">
      <span><kbd>↑</kbd> <kbd>↓</kbd> {t('palette.navigate', 'to navigate')}</span>
      <span><kbd>Enter</kbd> {t('palette.select', 'to select')}</span>
      <span><kbd>Ctrl+K</kbd> {t('palette.shortcutAnytime', 'anytime')}</span>
    </div>
  </div>
{/if}

<style>
  .palette-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    z-index: 2200;
  }

  .palette-modal {
    position: fixed;
    top: 14%;
    left: 50%;
    transform: translateX(-50%);
    width: 92%;
    max-width: 640px;
    max-height: 72vh;
    background: var(--bg-surface);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.65);
    z-index: 2201;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .search-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 16px;
    border-bottom: 1px solid var(--border-color);
    background: var(--toolbar-bg);
  }

  .search-icon {
    color: var(--accent-color);
    flex-shrink: 0;
  }

  .palette-input {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    color: var(--text-primary);
    font-size: 14px;
  }

  .esc-kbd {
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 4px;
    border: 1px solid var(--border-color);
    background: var(--btn-bg);
    color: var(--text-secondary);
    font-family: 'JetBrains Mono', Consolas, monospace;
  }

  .palette-results {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .empty-results {
    padding: 32px 16px;
    text-align: center;
    color: var(--text-secondary);
    font-size: 13px;
  }

  .palette-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 12px;
    border-radius: 8px;
    border: 1px solid transparent;
    background: transparent;
    cursor: pointer;
    text-align: left;
    transition: all 0.1s ease;
  }

  .palette-item.selected {
    background: var(--accent-subtle);
    border-color: rgba(99, 102, 241, 0.35);
  }

  .item-main {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .item-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .item-sub {
    font-size: 11.5px;
    color: var(--text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .item-badge {
    font-size: 10px;
    font-weight: 700;
    padding: 2px 7px;
    border-radius: 4px;
    background: var(--btn-bg);
    border: 1px solid var(--border-color);
    color: var(--text-secondary);
    flex-shrink: 0;
  }

  .item-badge.ai-badge {
    background: rgba(99, 102, 241, 0.16);
    border-color: rgba(99, 102, 241, 0.4);
    color: #a5b4fc;
  }

  .palette-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 16px;
    border-top: 1px solid var(--border-color);
    background: var(--toolbar-bg);
    font-size: 11px;
    color: var(--text-secondary);
  }

  .palette-footer kbd {
    font-size: 10px;
    padding: 1px 5px;
    border-radius: 3px;
    border: 1px solid var(--border-color);
    background: var(--btn-bg);
    font-family: 'JetBrains Mono', Consolas, monospace;
  }
</style>
