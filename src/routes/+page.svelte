<script lang="ts">
  import { onMount } from 'svelte';
  import type { Documentation, TabItem, AppSettings, DocSection } from '$lib/types';
  import {
    loadDocs,
    saveDocs,
    loadTabs,
    saveTabs,
    loadActiveTabId,
    saveActiveTabId,
    loadSettings,
    saveSettings
  } from '$lib/storage';
  import { applyThemePalette } from '$lib/themeRandomizer';
  import { initI18n } from '$lib/i18n/index.svelte';
  import { showToast } from '$lib/stores/toastStore.svelte';
  import { applyAppFont, registerCustomFontData } from '$lib/fontManager';

  import TitleBar from '$lib/components/TitleBar.svelte';
  import DocsBar from '$lib/components/DocsBar.svelte';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import EditorPreview from '$lib/components/EditorPreview.svelte';
  import AiModal from '$lib/components/AiModal.svelte';
  import AiSectionEnhanceModal from '$lib/components/AiSectionEnhanceModal.svelte';
  import AiDocAnalysisModal from '$lib/components/AiDocAnalysisModal.svelte';
  import NewDocModal from '$lib/components/NewDocModal.svelte';
  import ImportExportModal from '$lib/components/ImportExportModal.svelte';
  import SettingsModal from '$lib/components/SettingsModal.svelte';
  import CommandPaletteModal from '$lib/components/CommandPaletteModal.svelte';
  import ToastContainer from '$lib/components/ToastContainer.svelte';
  import ContextMenu from '$lib/components/ContextMenu.svelte';

  // App State
  let docs = $state<Documentation[]>([]);
  let tabs = $state<TabItem[]>([]);
  let activeTabId = $state<string>('');
  let settings = $state<AppSettings>({
    aiProvider: 'gemini',
    geminiApiKey: '',
    claudeApiKey: '',
    openaiApiKey: '',
    openrouterApiKey: '',
    openrouterModel: 'anthropic/claude-3.5-sonnet',
    apiKey: '',
    themeMode: 'dark',
    sidebarWidth: 280,
    uiLanguage: 'en'
  });

  let isSidebarOpen = $state<boolean>(true);
  let isDocsBarOpen = $state<boolean>(true);
  let docsBarPosition = $state<'left' | 'right'>('left');

  // Modals Visibility
  let isAiModalOpen = $state<boolean>(false);
  let isSectionEnhanceModalOpen = $state<boolean>(false);
  let enhanceModalScope = $state<'section' | 'document'>('section');
  let isDocAnalysisModalOpen = $state<boolean>(false);
  let isNewDocModalOpen = $state<boolean>(false);
  let isImportExportModalOpen = $state<boolean>(false);
  let isSettingsModalOpen = $state<boolean>(false);
  let isCommandPaletteOpen = $state<boolean>(false);
  let editingDocForMeta = $state<Documentation | null>(null);

  // Active Document
  let currentDoc = $derived(
    docs.find(d => d.id === activeTabId) || (docs.length > 0 ? docs[0] : null)
  );

  // Active Tab
  let currentTab = $derived(
    tabs.find(t => t.docId === activeTabId) || null
  );

  // Active Section ID
  let activeSectionId = $derived.by(() => {
    if (!currentDoc) return '';
    if (currentTab?.activeSectionId && currentDoc.sections.some(s => s.id === currentTab.activeSectionId)) {
      return currentTab.activeSectionId;
    }
    return currentDoc.sections[0]?.id || '';
  });

  let currentSection = $derived(
    currentDoc?.sections.find(s => s.id === activeSectionId) || null
  );

  // Active AI API Key derived cleanly without undefined values
  let activeAiApiKey = $derived.by(() => {
    if (settings.aiProvider === 'gemini') {
      return (settings.geminiApiKey || settings.apiKey || '').trim();
    }
    if (settings.aiProvider === 'claude') {
      return (settings.claudeApiKey || '').trim();
    }
    if (settings.aiProvider === 'openrouter') {
      return (settings.openrouterApiKey || '').trim();
    }
    if (settings.aiProvider === 'openai') {
      return (settings.openaiApiKey || '').trim();
    }
    return (settings.apiKey || '').trim();
  });

  // Active AI Model derived cleanly for each provider
  let activeAiModel = $derived.by(() => {
    if (settings.aiProvider === 'gemini') {
      return (settings.geminiModel || 'gemini-2.5-flash').trim();
    }
    if (settings.aiProvider === 'claude') {
      return (settings.claudeModel || 'claude-3-5-sonnet-latest').trim();
    }
    if (settings.aiProvider === 'openai') {
      return (settings.openaiModel || 'gpt-4o').trim();
    }
    if (settings.aiProvider === 'openrouter') {
      return (settings.openrouterModel || 'anthropic/claude-3.5-sonnet').trim();
    }
    return '';
  });

  // Auto-Save Flush Utility
  function flushAutoSave() {
    if (docs.length > 0) {
      saveDocs(docs);
    }
    if (tabs.length > 0) {
      saveTabs(tabs);
    }
    if (activeTabId) {
      saveActiveTabId(activeTabId);
    }
    if (settings) {
      saveSettings(settings);
    }
  }

  onMount(() => {
    // 1. Load documents & tabs
    const initialLoadedDocs = loadDocs();
    docs = initialLoadedDocs;

    const initialLoadedTabs = loadTabs(initialLoadedDocs);
    tabs = initialLoadedTabs;

    const initialActive = loadActiveTabId(initialLoadedTabs[0]?.docId || initialLoadedDocs[0]?.id || '');
    activeTabId = initialActive;

    // 2. Load settings, initialize theme palette & i18n
    const initialSettings = loadSettings();
    settings = initialSettings;
    applyThemePalette(initialSettings.customPalette || null, initialSettings.themeMode);
    initI18n(initialSettings.uiLanguage);

    // Apply global font
    if (initialSettings.customFontData && initialSettings.customFontName) {
      registerCustomFontData(initialSettings.customFontName, initialSettings.customFontData);
      applyAppFont(`'${initialSettings.customFontName}', sans-serif`);
    } else if (initialSettings.appFontFamily) {
      applyAppFont(initialSettings.appFontFamily);
    }

    // 3. Screen breakpoint handling
    if (window.innerWidth < 768) {
      isSidebarOpen = false;
    }

    // 4. Auto-save on window exit / tab navigation / close & Ctrl+K global shortcut
    function handleGlobalKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        isCommandPaletteOpen = !isCommandPaletteOpen;
      }
    }

    window.addEventListener('beforeunload', flushAutoSave);
    window.addEventListener('pagehide', flushAutoSave);
    window.addEventListener('keydown', handleGlobalKeyDown);

    return () => {
      flushAutoSave();
      window.removeEventListener('beforeunload', flushAutoSave);
      window.removeEventListener('pagehide', flushAutoSave);
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  });

  // State Persistence Effects
  $effect(() => {
    if (docs.length > 0) {
      saveDocs(docs);
    }
  });

  $effect(() => {
    if (tabs.length > 0) {
      saveTabs(tabs);
    }
  });

  $effect(() => {
    if (activeTabId) {
      saveActiveTabId(activeTabId);
    }
  });

  $effect(() => {
    if (settings) {
      saveSettings(settings);
    }
  });

  // Tab Switching & Management
  function selectTab(docId: string) {
    activeTabId = docId;
  }

  function closeTab(docIdToClose: string) {
    if (tabs.length <= 1) return;

    const index = tabs.findIndex(t => t.docId === docIdToClose);
    const newTabs = tabs.filter(t => t.docId !== docIdToClose);
    tabs = newTabs;

    if (activeTabId === docIdToClose) {
      const nextIndex = Math.min(index, newTabs.length - 1);
      activeTabId = newTabs[nextIndex].docId;
    }
  }

  function openDocInTab(docId: string) {
    const doc = docs.find(d => d.id === docId);
    if (!doc) return;

    const existingTab = tabs.find(t => t.docId === docId);
    if (existingTab) {
      activeTabId = docId;
    } else {
      tabs = [
        ...tabs,
        {
          docId: doc.id,
          title: doc.title,
          activeSectionId: doc.sections[0]?.id || ''
        }
      ];
      activeTabId = docId;
    }
  }

  function handleNewTabClick() {
    editingDocForMeta = null;
    isNewDocModalOpen = true;
  }

  // Reorder tabs along X-axis
  function handleReorderTabs(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;
    const reordered = [...tabs];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    tabs = reordered;
  }

  // Section Navigation
  function handleSelectSection(secId: string) {
    if (!currentTab) return;
    tabs = tabs.map(t => (t.docId === activeTabId ? { ...t, activeSectionId: secId } : t));
  }

  // Content Auto-Save
  function handleUpdateContent(newContent: string) {
    if (!currentDoc || !activeSectionId) return;

    docs = docs.map(d => {
      if (d.id === currentDoc.id) {
        return {
          ...d,
          updatedAt: new Date().toISOString(),
          sections: d.sections.map(s => {
            if (s.id === activeSectionId) {
              return { ...s, content: newContent };
            }
            return s;
          })
        };
      }
      return d;
    });
  }

  // Section Addition
  function handleAddSection() {
    if (!currentDoc) return;
    const newOrder = currentDoc.sections.length + 1;
    const newSecId = 'sec-' + Date.now();
    const newSection = {
      id: newSecId,
      title: `${newOrder}. New Section`,
      slug: `section-${newOrder}`,
      order: newOrder,
      content: `## ${newOrder}. New Section\n\nAuthor your technical content here.`
    };

    docs = docs.map(d => {
      if (d.id === currentDoc.id) {
        return {
          ...d,
          updatedAt: new Date().toISOString(),
          sections: [...d.sections, newSection]
        };
      }
      return d;
    });

    handleSelectSection(newSecId);
  }

  // Section Deletion
  function handleDeleteSection(secId: string) {
    if (!currentDoc || currentDoc.sections.length <= 1) return;

    docs = docs.map(d => {
      if (d.id === currentDoc.id) {
        const remaining = d.sections.filter(s => s.id !== secId);
        return {
          ...d,
          updatedAt: new Date().toISOString(),
          sections: remaining
        };
      }
      return d;
    });

    if (activeSectionId === secId) {
      const firstRemaining = currentDoc.sections.find(s => s.id !== secId);
      if (firstRemaining) {
        handleSelectSection(firstRemaining.id);
      }
    }
  }

  // Section Renaming
  function handleRenameSection(secId: string, newTitle: string) {
    if (!currentDoc) return;

    docs = docs.map(d => {
      if (d.id === currentDoc.id) {
        return {
          ...d,
          updatedAt: new Date().toISOString(),
          sections: d.sections.map(s => (s.id === secId ? { ...s, title: newTitle } : s))
        };
      }
      return d;
    });
  }

  // Section Reordering
  function handleMoveSection(secId: string, direction: 'up' | 'down') {
    if (!currentDoc) return;
    const index = currentDoc.sections.findIndex(s => s.id === secId);
    if (index === -1) return;
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === currentDoc.sections.length - 1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const list = [...currentDoc.sections];
    const [moved] = list.splice(index, 1);
    list.splice(targetIndex, 0, moved);

    docs = docs.map(d => {
      if (d.id === currentDoc.id) {
        return { ...d, updatedAt: new Date().toISOString(), sections: list };
      }
      return d;
    });
  }

  // Document Metadata Update
  function handleEditDocMeta() {
    if (!currentDoc) return;
    editingDocForMeta = currentDoc;
    isNewDocModalOpen = true;
  }

  function handleSaveDoc(docData: Partial<Documentation>) {
    if (editingDocForMeta) {
      docs = docs.map(d => {
        if (d.id === editingDocForMeta?.id) {
          return {
            ...d,
            ...docData,
            updatedAt: new Date().toISOString()
          };
        }
        return d;
      });

      tabs = tabs.map(t =>
        t.docId === editingDocForMeta?.id ? { ...t, title: docData.title || t.title } : t
      );
      showToast({
        type: 'success',
        title: 'Document Updated',
        message: `"${docData.title || editingDocForMeta.title}" metadata saved.`
      });
      editingDocForMeta = null;
    } else {
      const newDocId = 'doc-' + Date.now();
      const newDoc: Documentation = {
        id: newDocId,
        title: docData.title || 'New Document',
        description: docData.description || '',
        version: docData.version || '1.0.0',
        category: docData.category || 'General',
        author: docData.author || 'DokAI Team',
        tags: docData.tags || ['dokai'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        sections: docData.sections || [
          {
            id: 'sec-1',
            title: '1. Introduction',
            slug: 'intro',
            order: 1,
            content: `# ${docData.title || 'New Document'}\n\nStart authoring content here.`
          }
        ]
      };

      docs = [newDoc, ...docs];
      openDocInTab(newDoc.id);
      showToast({
        type: 'success',
        title: 'Document Created',
        message: `"${newDoc.title}" was created with ${newDoc.sections.length} section(s).`
      });
    }
  }

  // AI Generated Document Handler
  function handleDocCreatedByAi(newDoc: Documentation) {
    docs = [newDoc, ...docs];
    openDocInTab(newDoc.id);
  }

  // Active Document AI Enhancement Handler (Strictly isolates updates to target doc only)
  function handleDocEnhanced(docId: string, updatedSections: DocSection[]) {
    docs = docs.map(d => {
      if (d.id === docId) {
        return {
          ...d,
          sections: updatedSections,
          updatedAt: new Date().toISOString()
        };
      }
      return d;
    });
    flushAutoSave();
  }

  // Active Section Targeted AI Enhancement Handler (Strictly updates only the target section)
  function handleSectionUpdated(updatedSection: DocSection, targetDocId?: string) {
    const docId = targetDocId || currentDoc?.id;
    if (!docId) return;
    docs = docs.map(d => {
      if (d.id === docId) {
        return {
          ...d,
          sections: d.sections.map(s => s.id === updatedSection.id ? updatedSection : s),
          updatedAt: new Date().toISOString()
        };
      }
      return d;
    });
    flushAutoSave();
  }

  // Document Deletion
  function handleDeleteDoc(docIdToDelete: string) {
    if (docs.length <= 1) return;

    docs = docs.filter(d => d.id !== docIdToDelete);
    tabs = tabs.filter(t => t.docId !== docIdToDelete);

    if (activeTabId === docIdToDelete) {
      const fallback = tabs[0]?.docId || docs[0]?.id || '';
      activeTabId = fallback;
    }
  }

  // Document Cloning
  function handleCloneDoc(docIdToClone: string) {
    const original = docs.find(d => d.id === docIdToClone);
    if (!original) return;

    const clonedId = 'doc-' + Date.now();
    const clonedDoc: Documentation = {
      ...original,
      id: clonedId,
      title: `${original.title} (Copy)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sections: original.sections.map(s => ({
        ...s,
        id: 'sec-' + Math.random().toString(36).substring(2, 8)
      }))
    };

    docs = [clonedDoc, ...docs];
    openDocInTab(clonedId);
  }

  // Import Handler
  function handleImportSuccess(importedDocs: Documentation[]) {
    const newDocsList = [...docs];
    for (const imp of importedDocs) {
      const idx = newDocsList.findIndex(d => d.id === imp.id);
      if (idx >= 0) {
        newDocsList[idx] = imp;
      } else {
        newDocsList.unshift(imp);
      }
    }
    docs = newDocsList;

    if (importedDocs[0]) {
      openDocInTab(importedDocs[0].id);
    }
    showToast({
      type: 'success',
      title: 'Documents Imported',
      message: `Successfully imported ${importedDocs.length} document(s).`
    });
  }

  // Settings & Theme Management
  function handleUpdateSettings(newSettings: AppSettings) {
    settings = newSettings;
    applyThemePalette(newSettings.customPalette || null, newSettings.themeMode);
    if (newSettings.customFontData && newSettings.customFontName) {
      registerCustomFontData(newSettings.customFontName, newSettings.customFontData);
      applyAppFont(`'${newSettings.customFontName}', sans-serif`);
    } else if (newSettings.appFontFamily) {
      applyAppFont(newSettings.appFontFamily);
    }
    showToast({
      type: 'success',
      title: 'Settings Saved',
      message: 'Your preferences, AI provider, font, and theme have been updated.'
    });
  }

  // Toggle Both Sidebars (Sidebar & DocsBar)
  function handleToggleSidebars() {
    if (isSidebarOpen || isDocsBarOpen) {
      isSidebarOpen = false;
      isDocsBarOpen = false;
    } else {
      isSidebarOpen = true;
      isDocsBarOpen = true;
    }
  }

  // Sidebar Resizing
  function handleResizeSidebarWidth(newWidth: number) {
    settings = {
      ...settings,
      sidebarWidth: newWidth
    };
  }

  function handleSelectDocSectionFromPalette(docId: string, secId: string) {
    openDocInTab(docId);
    setTimeout(() => {
      tabs = tabs.map((t) => (t.docId === docId ? { ...t, activeSectionId: secId } : t));
    }, 0);
  }
</script>

<div class="dokai-app-shell">
  <!-- Chrome-Style Custom Titlebar -->
  <TitleBar
    {tabs}
    {activeTabId}
    {isDocsBarOpen}
    onSelectTab={selectTab}
    onCloseTab={closeTab}
    onNewTabClick={handleNewTabClick}
    onReorderTabs={handleReorderTabs}
    onOpenAiModal={() => (isAiModalOpen = true)}
    onOpenImportExport={() => (isImportExportModalOpen = true)}
    onToggleDocsBar={() => (isDocsBarOpen = !isDocsBarOpen)}
    onOpenSettings={() => (isSettingsModalOpen = true)}
    onOpenCommandPalette={() => (isCommandPaletteOpen = true)}
    onBeforeClose={flushAutoSave}
  />

  <!-- Main Body Layout -->
  <div class="main-body-layout">
    {#if docsBarPosition === 'left'}
      <DocsBar
        allDocs={docs}
        activeDocId={currentDoc?.id || activeTabId}
        isOpen={isDocsBarOpen}
        position="left"
        onOpenDoc={openDocInTab}
        onCreateNewDoc={handleNewTabClick}
        onCloneDoc={handleCloneDoc}
        onDeleteDoc={handleDeleteDoc}
        onToggleOpen={() => (isDocsBarOpen = false)}
        onTogglePosition={() => (docsBarPosition = 'right')}
      />
    {/if}

    <!-- Resizable Sections Sidebar -->
    <Sidebar
      {currentDoc}
      {activeSectionId}
      isOpen={isSidebarOpen}
      sidebarWidth={settings.sidebarWidth}
      onSelectSection={handleSelectSection}
      onAddSection={handleAddSection}
      onDeleteSection={handleDeleteSection}
      onRenameSection={handleRenameSection}
      onMoveSection={handleMoveSection}
      onEditDocMeta={handleEditDocMeta}
      onToggleSidebar={handleToggleSidebars}
      onResizeWidth={handleResizeSidebarWidth}
    />

    <!-- Editor & Live Markdown Preview Workspace -->
    <EditorPreview
      section={currentSection}
      allSections={currentDoc?.sections || []}
      docTitle={currentDoc?.title || ''}
      docAuthor={currentDoc?.author || ''}
      onUpdateContent={handleUpdateContent}
      onSelectSection={handleSelectSection}
      onToggleSidebar={handleToggleSidebars}
      onOpenAiEnhance={() => {
        enhanceModalScope = 'section';
        isSectionEnhanceModalOpen = true;
      }}
      onOpenDocAnalysis={() => (isDocAnalysisModalOpen = true)}
      isSidebarOpen={isSidebarOpen || isDocsBarOpen}
    />

    {#if docsBarPosition === 'right'}
      <DocsBar
        allDocs={docs}
        activeDocId={currentDoc?.id || activeTabId}
        isOpen={isDocsBarOpen}
        position="right"
        onOpenDoc={openDocInTab}
        onCreateNewDoc={handleNewTabClick}
        onCloneDoc={handleCloneDoc}
        onDeleteDoc={handleDeleteDoc}
        onToggleOpen={() => (isDocsBarOpen = false)}
        onTogglePosition={() => (docsBarPosition = 'left')}
      />
    {/if}
  </div>

  <!-- Dialog Modals -->
  <AiModal
    isOpen={isAiModalOpen}
    apiKey={activeAiApiKey}
    provider={settings.aiProvider}
    selectedModel={activeAiModel}
    openrouterModel={settings.openrouterModel}
    onClose={() => (isAiModalOpen = false)}
    onDocCreated={handleDocCreatedByAi}
  />

  <!-- Dual-Mode AI Enhance Modal (Active Section Only OR Revise All Sections) -->
  <AiSectionEnhanceModal
    isOpen={isSectionEnhanceModalOpen}
    initialScope={enhanceModalScope}
    doc={currentDoc}
    section={currentSection}
    apiKey={activeAiApiKey}
    provider={settings.aiProvider}
    selectedModel={activeAiModel}
    openrouterModel={settings.openrouterModel}
    onClose={() => (isSectionEnhanceModalOpen = false)}
    onSectionUpdated={handleSectionUpdated}
    onDocEnhanced={handleDocEnhanced}
  />

  <!-- Document Inaccuracy & Accuracy Technical Audit Report Modal -->
  <AiDocAnalysisModal
    isOpen={isDocAnalysisModalOpen}
    doc={currentDoc}
    apiKey={activeAiApiKey}
    provider={settings.aiProvider}
    selectedModel={activeAiModel}
    openrouterModel={settings.openrouterModel}
    onClose={() => (isDocAnalysisModalOpen = false)}
    onSelectSection={handleSelectSection}
    onSectionUpdated={handleSectionUpdated}
  />

  <NewDocModal
    isOpen={isNewDocModalOpen}
    initialData={editingDocForMeta}
    onClose={() => {
      isNewDocModalOpen = false;
      editingDocForMeta = null;
    }}
    onSave={handleSaveDoc}
  />

  <ImportExportModal
    isOpen={isImportExportModalOpen}
    {currentDoc}
    allDocs={docs}
    onClose={() => (isImportExportModalOpen = false)}
    onImportSuccess={handleImportSuccess}
  />

  <SettingsModal
    isOpen={isSettingsModalOpen}
    {settings}
    onClose={() => (isSettingsModalOpen = false)}
    onUpdateSettings={handleUpdateSettings}
  />

  <CommandPaletteModal
    isOpen={isCommandPaletteOpen}
    {docs}
    onClose={() => (isCommandPaletteOpen = false)}
    onSelectDocSection={handleSelectDocSectionFromPalette}
    onCreateNewDoc={() => {
      editingDocForMeta = null;
      isNewDocModalOpen = true;
    }}
    onOpenAiGenerator={() => (isAiModalOpen = true)}
    onOpenAiSectionEnhance={() => (isSectionEnhanceModalOpen = true)}
    onOpenDocAnalysis={() => (isDocAnalysisModalOpen = true)}
    onOpenImportExport={() => (isImportExportModalOpen = true)}
    onOpenSettings={() => (isSettingsModalOpen = true)}
    onToggleSidebar={handleToggleSidebars}
  />

  <!-- Global Right-Side Dismissible Toast Notification Stack (30s auto-close) -->
  <ToastContainer />

  <!-- Global Native-Feeling Desktop Context Menu (Suppresses Default Browser Menu in Production) -->
  <ContextMenu
    onNewDoc={handleNewTabClick}
    onOpenSearch={() => (isCommandPaletteOpen = true)}
    onOpenAiModal={() => (isAiModalOpen = true)}
    onOpenSettings={() => (isSettingsModalOpen = true)}
    onEnhance={() => {
      enhanceModalScope = 'section';
      isSectionEnhanceModalOpen = true;
    }}
  />
</div>

<style>
  :global(:root) {
    /* Global Dynamic Typography */
    --app-font: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;

    /* Default Pitch Black Theme Baseline */
    --bg-base: #000000;
    --bg-surface: #0a0a0a;
    --titlebar-bg: #050505;
    --toolbar-bg: #0c0c0c;
    --sidebar-bg: #050505;
    --editor-bg: #000000;
    --preview-bg: #050505;
    --border-color: #1a1a1a;
    --border-hover-color: #2e2e2e;

    --text-primary: #ededed;
    --text-secondary: #888888;
    --accent-color: #6366f1;
    --accent-subtle: rgba(99, 102, 241, 0.12);
    --badge-bg: rgba(99, 102, 241, 0.18);

    --tab-inactive-text: #888888;
    --tab-hover-bg: rgba(255, 255, 255, 0.05);
    --close-hover-bg: rgba(255, 255, 255, 0.1);

    --btn-bg: #141414;
    --btn-hover-bg: #222222;
    --input-bg: #050505;

    --code-inline-bg: #141414;
    --code-block-bg: #000000;

    --scrollbar-track: #050505;
    --scrollbar-thumb: #222222;
    --scrollbar-thumb-hover: #333333;
  }

  :global([data-theme='light']) {
    /* Default Light Theme Baseline */
    --bg-base: #f8fafc;
    --bg-surface: #ffffff;
    --titlebar-bg: #e2e8f0;
    --toolbar-bg: #f1f5f9;
    --sidebar-bg: #f8fafc;
    --editor-bg: #ffffff;
    --preview-bg: #f8fafc;
    --border-color: #e2e8f0;
    --border-hover-color: #cbd5e1;

    --text-primary: #0f172a;
    --text-secondary: #64748b;
    --accent-color: #4f46e5;
    --accent-subtle: rgba(79, 70, 229, 0.08);
    --badge-bg: rgba(79, 70, 229, 0.12);

    --tab-inactive-text: #64748b;
    --tab-hover-bg: rgba(0, 0, 0, 0.05);
    --close-hover-bg: rgba(0, 0, 0, 0.08);

    --btn-bg: #e2e8f0;
    --btn-hover-bg: #cbd5e1;
    --input-bg: #f1f5f9;

    --code-inline-bg: #f1f5f9;
    --code-block-bg: #0f172a;

    --scrollbar-track: rgba(241, 245, 249, 0.6);
    --scrollbar-thumb: #cbd5e1;
    --scrollbar-thumb-hover: #94a3b8;
  }

  :global(body) {
    margin: 0;
    padding: 0;
    font-family: var(--app-font);
    background-color: var(--bg-surface);
    color: var(--text-primary);
    overflow: hidden;
    height: 100vh;
    width: 100vw;
  }

  :global(button),
  :global(input),
  :global(select),
  :global(textarea) {
    font-family: var(--app-font);
  }

  :global(*) {
    box-sizing: border-box;
  }

  /* Global Sleek Custom Scrollbars */
  :global(*::-webkit-scrollbar) {
    width: 6px;
    height: 6px;
  }

  :global(*::-webkit-scrollbar-track) {
    background: var(--scrollbar-track, rgba(0, 0, 0, 0.1));
    border-radius: 4px;
  }

  :global(*::-webkit-scrollbar-thumb) {
    background: var(--scrollbar-thumb, #475569);
    border-radius: 4px;
    transition: background 0.15s ease;
  }

  :global(*::-webkit-scrollbar-thumb:hover) {
    background: var(--scrollbar-thumb-hover, #64748b);
  }

  :global(*::-webkit-scrollbar-corner) {
    background: transparent;
  }

  /* Firefox Standard Scrollbar */
  :global(*) {
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-thumb, #475569) var(--scrollbar-track, transparent);
  }

  .dokai-app-shell {
    display: flex;
    flex-direction: column;
    height: 100vh;
    width: 100vw;
    background-color: var(--bg-surface);
    overflow: hidden;
  }

  .main-body-layout {
    display: flex;
    flex: 1;
    overflow: hidden;
    position: relative;
  }
</style>
