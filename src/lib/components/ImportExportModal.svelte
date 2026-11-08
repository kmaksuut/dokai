<script lang="ts">
  import { marked } from 'marked';
  import type { Documentation } from '../types';
  import { saveFileWithDialog } from '../fileExporter';
  import { t } from '../i18n/index.svelte';

  interface Props {
    isOpen: boolean;
    currentDoc: Documentation | null;
    allDocs: Documentation[];
    onClose: () => void;
    onImportSuccess: (importedDocs: Documentation[]) => void;
  }

  let { isOpen, currentDoc, allDocs, onClose, onImportSuccess }: Props = $props();

  let activeTab = $state<'export' | 'import'>('export');
  let importError = $state<string | null>(null);
  let importSuccessMsg = $state<string | null>(null);
  let exportSuccessMsg = $state<string | null>(null);
  let isDragging = $state(false);

  // Native Save File Dialog via Explorer
  async function exportCurrentDocJson() {
    if (!currentDoc) return;
    const safeName = currentDoc.title.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '_') || 'document';
    const jsonStr = JSON.stringify(currentDoc, null, 2);
    
    const saved = await saveFileWithDialog(
      `dokai_${safeName}.json`,
      jsonStr,
      'application/json',
      'json',
      'DokAI Document JSON (*.json)'
    );

    if (saved) {
      exportSuccessMsg = 'Document successfully exported!';
      setTimeout(() => (exportSuccessMsg = null), 2500);
    }
  }

  async function exportAllDocsJson() {
    const dateStr = new Date().toISOString().slice(0, 10);
    const backupData = {
      app: 'DokAI',
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      documents: allDocs
    };
    const jsonStr = JSON.stringify(backupData, null, 2);

    const saved = await saveFileWithDialog(
      `dokai_full_backup_${dateStr}.json`,
      jsonStr,
      'application/json',
      'json',
      'DokAI Full Backup (*.json)'
    );

    if (saved) {
      exportSuccessMsg = 'All documents backup saved successfully!';
      setTimeout(() => (exportSuccessMsg = null), 2500);
    }
  }

  async function exportCurrentDocMarkdown() {
    if (!currentDoc) return;
    let fullMd = `# ${currentDoc.title}\n\n`;
    if (currentDoc.description) {
      fullMd += `> ${currentDoc.description}\n\n`;
    }
    for (const sec of currentDoc.sections) {
      fullMd += `\n---\n\n${sec.content}\n\n`;
    }

    const safeName = currentDoc.title.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '_') || 'document';
    const saved = await saveFileWithDialog(
      `dokai_${safeName}.md`,
      fullMd,
      'text/markdown',
      'md',
      'Markdown File (*.md)'
    );

    if (saved) {
      exportSuccessMsg = 'Markdown file saved successfully!';
      setTimeout(() => (exportSuccessMsg = null), 2500);
    }
  }

  async function exportCurrentDocHtml() {
    if (!currentDoc) return;
    const safeName = currentDoc.title.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '_') || 'document';

    const tocHtml = currentDoc.sections
      .map((s, idx) => `<a href="#sec-${idx}" class="toc-link">${idx + 1}. ${s.title}</a>`)
      .join('\n');

    const sectionsHtml = currentDoc.sections
      .map((s, idx) => {
        const rendered = marked.parse(s.content || '') as string;
        return `<section id="sec-${idx}" class="doc-section">${rendered}</section>`;
      })
      .join('\n<hr class="sec-divider" />\n');

    const htmlDoc = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${currentDoc.title} — DokAI Documentation</title>
  <style>
    :root {
      --bg: #000000;
      --surface: #0a0a0a;
      --border: #1f1f22;
      --text: #f4f4f6;
      --muted: #9ca3af;
      --accent: #6366f1;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      display: flex;
      min-height: 100vh;
      line-height: 1.7;
    }
    aside {
      width: 280px;
      background: var(--surface);
      border-right: 1px solid var(--border);
      padding: 24px 16px;
      position: sticky;
      top: 0;
      height: 100vh;
      overflow-y: auto;
      flex-shrink: 0;
    }
    .doc-brand {
      font-size: 16px;
      font-weight: 800;
      color: var(--text);
      margin-bottom: 4px;
    }
    .doc-meta {
      font-size: 11px;
      color: var(--muted);
      margin-bottom: 20px;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--border);
    }
    .toc-link {
      display: block;
      padding: 7px 10px;
      color: var(--muted);
      text-decoration: none;
      font-size: 13px;
      border-radius: 6px;
      margin-bottom: 2px;
    }
    .toc-link:hover {
      background: #141417;
      color: var(--text);
    }
    main {
      flex: 1;
      max-width: 920px;
      padding: 40px 48px 80px 48px;
      margin: 0 auto;
    }
    h1, h2, h3 { color: #ffffff; letter-spacing: -0.3px; }
    h1 { font-size: 28px; border-bottom: 1px solid var(--border); padding-bottom: 10px; }
    h2 { font-size: 21px; margin-top: 28px; }
    pre {
      background: #09090b;
      border: 1px solid var(--border);
      padding: 14px 16px;
      border-radius: 8px;
      overflow-x: auto;
      font-family: "JetBrains Mono", Consolas, monospace;
      font-size: 13px;
    }
    code:not(pre code) {
      background: rgba(99, 102, 241, 0.14);
      color: #a5b4fc;
      padding: 2px 6px;
      border-radius: 4px;
      font-family: "JetBrains Mono", Consolas, monospace;
      font-size: 12.5px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0;
      font-size: 13.5px;
    }
    th, td {
      border: 1px solid var(--border);
      padding: 8px 12px;
      text-align: left;
    }
    th { background: #121215; }
    blockquote {
      border-left: 4px solid var(--accent);
      background: rgba(99, 102, 241, 0.08);
      margin: 16px 0;
      padding: 10px 16px;
      border-radius: 6px;
    }
    .sec-divider {
      border: none;
      border-top: 1px solid var(--border);
      margin: 48px 0;
    }
    a { color: #818cf8; }
  </style>
</head>
<body>
  <aside>
    <div class="doc-brand">${currentDoc.title}</div>
    <div class="doc-meta">v${currentDoc.version || '1.0.0'} • ${currentDoc.category || 'Documentation'}</div>
    <nav>${tocHtml}</nav>
  </aside>
  <main>
    ${sectionsHtml}
  </main>
</body>
</html>`;

    const saved = await saveFileWithDialog(
      `dokai_${safeName}.html`,
      htmlDoc,
      'text/html',
      'html',
      'Standalone HTML Documentation (*.html)'
    );

    if (saved) {
      exportSuccessMsg = 'Standalone HTML documentation exported!';
      setTimeout(() => (exportSuccessMsg = null), 2500);
    }
  }

  // Import JSON Logic
  function handleFileSelect(e: Event) {
    const target = e.target as HTMLInputElement;
    const files = target.files;
    if (files && files[0]) {
      processFile(files[0]);
    }
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    isDragging = false;
    if (e.dataTransfer && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  }

  function processFile(file: File) {
    importError = null;
    importSuccessMsg = null;

    if (!file.name.endsWith('.json')) {
      importError = 'Please select a valid .json file.';
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const rawContent = event.target?.result as string;
        const parsed = JSON.parse(rawContent);

        let docsToImport: Documentation[] = [];

        if (Array.isArray(parsed)) {
          docsToImport = parsed;
        } else if (parsed && Array.isArray(parsed.documents)) {
          docsToImport = parsed.documents;
        } else if (parsed && parsed.title && Array.isArray(parsed.sections)) {
          docsToImport = [parsed];
        } else {
          throw new Error('File does not match DokAI document or backup format.');
        }

        const sanitized: Documentation[] = docsToImport.map((d, i) => ({
          id: d.id || 'imported-' + Date.now() + '-' + i,
          title: d.title || 'Imported Document',
          description: d.description || '',
          version: d.version || '1.0.0',
          category: d.category || 'Imported',
          tags: Array.isArray(d.tags) ? d.tags : ['imported'],
          createdAt: d.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          sections: Array.isArray(d.sections) && d.sections.length > 0 ? d.sections : [
            {
              id: 'sec-1',
              title: 'Introduction',
              slug: 'intro',
              order: 1,
              content: `# ${d.title || 'Document'}\n\nContent imported.`
            }
          ]
        }));

        importSuccessMsg = `${sanitized.length} document(s) imported successfully!`;
        onImportSuccess(sanitized);

        setTimeout(() => {
          onClose();
        }, 1200);
      } catch (err: any) {
        console.error('Import error:', err);
        importError = err.message || 'Error parsing selected JSON file.';
      }
    };

    reader.readAsText(file);
  }
</script>

{#if isOpen}
  <div class="modal-backdrop" onclick={onClose} aria-hidden="true"></div>

  <div class="modal-container" role="dialog" aria-modal="true">
    <div class="modal-header">
      <div class="header-left">
        <h2 class="modal-title">{t('importExport.title', 'JSON Import & Export')}</h2>
        <p class="modal-subtitle">{t('importExport.subtitle', 'Share, backup, or import documents with native file explorer dialogues.')}</p>
      </div>
      <button class="close-btn" onclick={onClose} title={t('common.close', 'Close')}>✕</button>
    </div>

    <!-- Nav Tabs -->
    <div class="modal-nav">
      <button
        class="nav-tab"
        class:active={activeTab === 'export'}
        onclick={() => (activeTab = 'export')}
      >
        📤 {t('importExport.exportTab', 'Export Documents')}
      </button>
      <button
        class="nav-tab"
        class:active={activeTab === 'import'}
        onclick={() => (activeTab = 'import')}
      >
        📥 {t('importExport.importTab', 'Import Documents')}
      </button>
    </div>

    <div class="modal-body">
      {#if activeTab === 'export'}
        <div class="export-section">
          {#if exportSuccessMsg}
            <div class="banner success">✓ {exportSuccessMsg}</div>
          {/if}

          {#if currentDoc}
            <div class="export-card">
              <div class="export-card-info">
                <span class="export-card-title">{t('importExport.activeDoc', 'Active Document')}: "{currentDoc.title}"</span>
                <span class="export-card-desc">
                  {t('importExport.activeDocDesc', 'Opens file explorer to save all sections in structured JSON format.')}
                </span>
              </div>
              <button class="action-btn-export" onclick={exportCurrentDocJson}>
                <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                <span>{t('importExport.saveJsonAs', 'Save JSON As...')}</span>
              </button>
            </div>

            <div class="export-card">
              <div class="export-card-info">
                <span class="export-card-title">{t('importExport.standaloneMd', 'Standalone Markdown (.md)')}</span>
                <span class="export-card-desc">
                  {t('importExport.standaloneMdDesc', 'Exports current document sections merged into a single standard Markdown document.')}
                </span>
              </div>
              <button class="action-btn-export secondary" onclick={exportCurrentDocMarkdown}>
                <span>{t('importExport.saveMdAs', 'Save Markdown As...')}</span>
              </button>
            </div>

            <div class="export-card">
              <div class="export-card-info">
                <span class="export-card-title">{t('importExport.standaloneHtml', 'Standalone Web Documentation (.html)')}</span>
                <span class="export-card-desc">
                  {t('importExport.standaloneHtmlDesc', 'Exports a self-contained dark-mode HTML documentation page with a sidebar Table of Contents.')}
                </span>
              </div>
              <button class="action-btn-export secondary" onclick={exportCurrentDocHtml}>
                <span>{t('importExport.saveHtmlAs', 'Save HTML As...')}</span>
              </button>
            </div>
          {/if}

          <div class="export-card highlight">
            <div class="export-card-info">
              <span class="export-card-title">{t('importExport.fullBackup', 'Complete Library Backup')} ({allDocs.length} Docs)</span>
              <span class="export-card-desc">
                {t('importExport.fullBackupDesc', 'Saves your entire documentation library into a portable JSON backup file.')}
              </span>
            </div>
            <button class="action-btn-export primary" onclick={exportAllDocsJson}>
              <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                <polyline points="17 21 17 13 7 13 7 21"></polyline>
                <polyline points="7 3 7 8 15 8"></polyline>
              </svg>
              <span>{t('importExport.saveBackupAs', 'Save Full Backup As...')}</span>
            </button>
          </div>
        </div>
      {:else}
        <div class="import-section">
          {#if importError}
            <div class="banner error">⚠️ {importError}</div>
          {/if}
          {#if importSuccessMsg}
            <div class="banner success">✓ {importSuccessMsg}</div>
          {/if}

          <!-- Drag and Drop Dropzone -->
          <div
            class="drop-zone"
            class:dragging={isDragging}
            ondragover={(e) => { e.preventDefault(); isDragging = true; }}
            ondragleave={() => (isDragging = false)}
            ondrop={handleDrop}
            role="region"
            aria-label="File Upload Dropzone"
          >
            <div class="drop-icon">📁</div>
            <p class="drop-title">{t('importExport.dropTitle', 'Drag & Drop JSON File Here')}</p>
            <p class="drop-subtitle">{t('importExport.dropSubtitle', 'or browse your computer to select a backup file')}</p>

            <label class="file-picker-btn">
              <span>{t('importExport.browseFiles', 'Browse Files (.json)')}</span>
              <input type="file" accept=".json" onchange={handleFileSelect} class="hidden-input" />
            </label>
          </div>

          <div class="format-hint">
            <strong>{t('importExport.supportedFormats', 'Supported Formats')}:</strong> {t('importExport.formatsDesc', 'Any DokAI single-document JSON or multi-document full library backups.')}
          </div>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.65);
    backdrop-filter: blur(4px);
    z-index: 1000;
  }

  .modal-container {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 90%;
    max-width: 580px;
    background: var(--bg-surface);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.4);
    z-index: 1001;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 18px 22px;
    border-bottom: 1px solid var(--border-color);
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
  }

  .close-btn:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .modal-nav {
    display: flex;
    background: var(--toolbar-bg);
    border-bottom: 1px solid var(--border-color);
    padding: 0 16px;
  }

  .nav-tab {
    padding: 10px 16px;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-secondary);
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .nav-tab:hover {
    color: var(--text-primary);
  }

  .nav-tab.active {
    color: var(--accent-color);
    border-bottom-color: var(--accent-color);
  }

  .modal-body {
    padding: 22px;
  }

  .export-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .export-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 14px 16px;
    background: var(--input-bg);
    border: 1px solid var(--border-color);
    border-radius: 8px;
  }

  .export-card.highlight {
    background: var(--accent-subtle);
    border-color: rgba(99, 102, 241, 0.4);
  }

  .export-card-info {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .export-card-title {
    font-size: 13.5px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .export-card-desc {
    font-size: 11.5px;
    color: var(--text-secondary);
    line-height: 1.4;
  }

  .action-btn-export {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 7px 14px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    border: 1px solid var(--border-color);
    background: var(--btn-bg);
    color: var(--text-primary);
    white-space: nowrap;
    transition: all 0.15s ease;
  }

  .action-btn-export:hover {
    background: var(--btn-hover-bg);
  }

  .action-btn-export.primary {
    background: var(--accent-color);
    color: #ffffff;
    border-color: transparent;
  }

  .action-btn-export.primary:hover {
    opacity: 0.95;
    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.35);
  }

  .import-section {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .banner {
    padding: 10px 14px;
    border-radius: 6px;
    font-size: 12.5px;
  }

  .banner.error {
    background: rgba(239, 68, 68, 0.12);
    border: 1px solid #ef4444;
    color: #ef4444;
  }

  .banner.success {
    background: rgba(16, 185, 129, 0.12);
    border: 1px solid #10b981;
    color: #10b981;
  }

  .drop-zone {
    border: 2px dashed var(--border-color);
    border-radius: 10px;
    padding: 32px 20px;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: var(--input-bg);
    transition: all 0.15s ease;
  }

  .drop-zone.dragging {
    border-color: var(--accent-color);
    background: var(--accent-subtle);
  }

  .drop-icon {
    font-size: 36px;
    margin-bottom: 8px;
  }

  .drop-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
  }

  .drop-subtitle {
    font-size: 12px;
    color: var(--text-secondary);
    margin: 4px 0 16px 0;
  }

  .file-picker-btn {
    display: inline-block;
    padding: 8px 18px;
    border-radius: 6px;
    background: var(--accent-color);
    color: #ffffff;
    font-size: 12.5px;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.15s ease;
  }

  .file-picker-btn:hover {
    opacity: 0.92;
  }

  .hidden-input {
    display: none;
  }

  .format-hint {
    font-size: 11.5px;
    color: var(--text-secondary);
    line-height: 1.5;
  }
</style>
