<script lang="ts">
  import { marked } from 'marked';
  import type { DocSection, ViewMode } from '../types';
  import {
    executeCode,
    isLanguageRunnable,
    triggerToolchainInstall,
    type CodeRunOutput
  } from '../codeRunner';
  import { highlightCodeElement } from '../highlighter';
  import { sanitizeSectionMarkdown } from '../aiGenerator';
  import { t } from '../i18n/index.svelte';

  interface Props {
    section: DocSection | null;
    allSections?: DocSection[];
    docTitle: string;
    docAuthor?: string;
    onUpdateContent: (content: string) => void;
    onSelectSection?: (secId: string) => void;
    onToggleSidebar: () => void;
    isSidebarOpen: boolean;
    onOpenAiEnhance?: () => void;
    onOpenDocAnalysis?: () => void;
  }

  let {
    section,
    allSections = [],
    docTitle,
    docAuthor = '',
    onUpdateContent,
    onSelectSection,
    onToggleSidebar,
    isSidebarOpen,
    onOpenAiEnhance,
    onOpenDocAnalysis
  }: Props = $props();

  let viewMode = $state<ViewMode>('split');
  let editorTextarea = $state<HTMLTextAreaElement | null>(null);
  let previewContainer = $state<HTMLDivElement | null>(null);
  let copyFeedback = $state<string | null>(null);

  // In-Section Find & Replace State
  let showFindBar = $state(false);
  let findQuery = $state('');
  let replaceQuery = $state('');

  let currentSectionIndex = $derived(
    section && allSections.length > 0 ? allSections.findIndex(s => s.id === section.id) : -1
  );
  let prevSection = $derived(currentSectionIndex > 0 ? allSections[currentSectionIndex - 1] : null);
  let nextSection = $derived(
    currentSectionIndex >= 0 && currentSectionIndex < allSections.length - 1
      ? allSections[currentSectionIndex + 1]
      : null
  );

  let wordCount = $derived(
    section?.content ? section.content.trim().split(/\s+/).filter(Boolean).length : 0
  );
  let readingTimeMin = $derived(Math.max(1, Math.ceil(wordCount / 200)));

  // Synchronize textarea value when section or section.content updates externally (e.g. from AI Enhancement)
  $effect(() => {
    if (editorTextarea && section) {
      if (editorTextarea.value !== section.content) {
        editorTextarea.value = section.content;
      }
    }
  });

  interface HtmlSuggestion {
    tag: string;
    label: string;
    desc: string;
    template: string;
    cursorOffset: number;
    popular?: boolean;
  }

  // Standard Comprehensive HTML/Markdown Tag Catalog
  const ALL_HTML_SUGGESTIONS: HtmlSuggestion[] = [
    { tag: 'div', label: '<div>', desc: 'Generic Content Container Block', template: '<div>\n  $1\n</div>', cursorOffset: 8, popular: true },
    { tag: 'span', label: '<span>', desc: 'Inline Text Container', template: '<span>$1</span>', cursorOffset: 6, popular: true },
    { tag: 'p', label: '<p>', desc: 'Paragraph Block', template: '<p>$1</p>', cursorOffset: 3, popular: true },
    { tag: 'code', label: '<code>', desc: 'Inline Code Monospace', template: '<code>$1</code>', cursorOffset: 6, popular: true },
    { tag: 'pre', label: '<pre>', desc: 'Preformatted Code Block', template: '<pre>\n$1\n</pre>', cursorOffset: 6, popular: true },
    { tag: 'kbd', label: '<kbd>', desc: 'Keyboard Key Shortcut', template: '<kbd>$1</kbd>', cursorOffset: 5, popular: true },
    { tag: 'mark', label: '<mark>', desc: 'Highlighted Color Mark', template: '<mark>$1</mark>', cursorOffset: 6, popular: true },
    { tag: 'details', label: '<details>', desc: 'Collapsible Summary Dropdown', template: '<details>\n  <summary>$1</summary>\n  Content\n</details>', cursorOffset: 20, popular: true },
    { tag: 'summary', label: '<summary>', desc: 'Collapsible Details Header', template: '<summary>$1</summary>', cursorOffset: 9 },
    { tag: 'blockquote', label: '<blockquote>', desc: 'Indented Quotation Block', template: '<blockquote>\n  $1\n</blockquote>', cursorOffset: 14, popular: true },
    { tag: 'strong', label: '<strong>', desc: 'Strong Urgent Importance', template: '<strong>$1</strong>', cursorOffset: 8, popular: true },
    { tag: 'b', label: '<b>', desc: 'Bold / Stylistic Importance', template: '<b>$1</b>', cursorOffset: 3 },
    { tag: 'em', label: '<em>', desc: 'Emphasized Stress Text', template: '<em>$1</em>', cursorOffset: 4 },
    { tag: 'i', label: '<i>', desc: 'Italic / Alternate Voice', template: '<i>$1</i>', cursorOffset: 3 },
    { tag: 'u', label: '<u>', desc: 'Underlined Annotation', template: '<u>$1</u>', cursorOffset: 3 },
    { tag: 'ins', label: '<ins>', desc: 'Inserted / Updated Text', template: '<ins>$1</ins>', cursorOffset: 5 },
    { tag: 'del', label: '<del>', desc: 'Strikethrough Deleted Text', template: '<del>$1</del>', cursorOffset: 5 },
    { tag: 's', label: '<s>', desc: 'Inaccurate / Struck Line', template: '<s>$1</s>', cursorOffset: 3 },
    { tag: 'sub', label: '<sub>', desc: 'Subscript Text (e.g. H₂O)', template: '<sub>$1</sub>', cursorOffset: 5 },
    { tag: 'sup', label: '<sup>', desc: 'Superscript Text (e.g. E=mc²)', template: '<sup>$1</sup>', cursorOffset: 5 },
    { tag: 'small', label: '<small>', desc: 'Fine Print / Small Annotation', template: '<small>$1</small>', cursorOffset: 7 },
    { tag: 'abbr', label: '<abbr>', desc: 'Abbreviation Tooltip', template: '<abbr title="Description">$1</abbr>', cursorOffset: 27 },
    { tag: 'a', label: '<a>', desc: 'Hyperlink Anchor', template: '<a href="$1" target="_blank">Link</a>', cursorOffset: 9, popular: true },
    { tag: 'img', label: '<img>', desc: 'Inline Image Element', template: '<img src="$1" alt="Image" />', cursorOffset: 10 },
    { tag: 'table', label: '<table>', desc: 'Structured Data Table', template: '<table>\n  <thead>\n    <tr>\n      <th>$1Header</th>\n    </tr>\n  </thead>\n  <tbody>\n    <tr>\n      <td>Data</td>\n    </tr>\n  </tbody>\n</table>', cursorOffset: 35, popular: true },
    { tag: 'thead', label: '<thead>', desc: 'Table Header Group', template: '<thead>\n  $1\n</thead>', cursorOffset: 9 },
    { tag: 'tbody', label: '<tbody>', desc: 'Table Body Rows Group', template: '<tbody>\n  $1\n</tbody>', cursorOffset: 9 },
    { tag: 'tr', label: '<tr>', desc: 'Table Row', template: '<tr>\n  <td>$1</td>\n</tr>', cursorOffset: 9 },
    { tag: 'th', label: '<th>', desc: 'Table Header Cell', template: '<th>$1</th>', cursorOffset: 4 },
    { tag: 'td', label: '<td>', desc: 'Table Data Cell', template: '<td>$1</td>', cursorOffset: 4 },
    { tag: 'ul', label: '<ul>', desc: 'Unordered Bullet List', template: '<ul>\n  <li>$1</li>\n</ul>', cursorOffset: 9 },
    { tag: 'ol', label: '<ol>', desc: 'Numbered Ordered List', template: '<ol>\n  <li>$1</li>\n</ol>', cursorOffset: 9 },
    { tag: 'li', label: '<li>', desc: 'List Item', template: '<li>$1</li>', cursorOffset: 4 },
    { tag: 'section', label: '<section>', desc: 'Document Semantic Section', template: '<section>\n  $1\n</section>', cursorOffset: 11 },
    { tag: 'article', label: '<article>', desc: 'Self-Contained Composition', template: '<article>\n  $1\n</article>', cursorOffset: 11 },
    { tag: 'header', label: '<header>', desc: 'Document / Section Header', template: '<header>\n  $1\n</header>', cursorOffset: 10 },
    { tag: 'footer', label: '<footer>', desc: 'Document / Section Footer', template: '<footer>\n  $1\n</footer>', cursorOffset: 10 },
    { tag: 'button', label: '<button>', desc: 'Clickable Action Button', template: '<button type="button">$1</button>', cursorOffset: 22 },
    { tag: 'video', label: '<video>', desc: 'Embedded Video Player', template: '<video src="$1" controls></video>', cursorOffset: 12 },
    { tag: 'audio', label: '<audio>', desc: 'Embedded Audio Player', template: '<audio src="$1" controls></audio>', cursorOffset: 12 },
    { tag: 'iframe', label: '<iframe>', desc: 'Embedded Web Frame', template: '<iframe src="$1" width="100%" height="400"></iframe>', cursorOffset: 13 },
    { tag: 'figure', label: '<figure>', desc: 'Figure with Caption', template: '<figure>\n  <img src="$1" alt="Figure" />\n  <figcaption>Caption</figcaption>\n</figure>', cursorOffset: 21 },
    { tag: 'h1', label: '<h1>', desc: 'Level 1 Heading', template: '<h1>$1</h1>', cursorOffset: 4 },
    { tag: 'h2', label: '<h2>', desc: 'Level 2 Heading', template: '<h2>$1</h2>', cursorOffset: 4 },
    { tag: 'h3', label: '<h3>', desc: 'Level 3 Heading', template: '<h3>$1</h3>', cursorOffset: 4 },
    { tag: 'hr', label: '<hr>', desc: 'Horizontal Thematic Divider', template: '<hr />$1', cursorOffset: 6 },
    { tag: 'br', label: '<br>', desc: 'Line Break', template: '<br />$1', cursorOffset: 6 }
  ];

  let showAutocomplete = $state(false);
  let autocompleteQuery = $state('');
  let selectedSuggestionIndex = $state(0);
  let autocompleteTriggerPos = $state<number | null>(null);
  let autocompleteCoords = $state<{ top: number; left: number }>({ top: 40, left: 30 });

  // Filter tags dynamically matching first letter or query prefix
  let filteredSuggestions = $derived.by(() => {
    const q = autocompleteQuery.toLowerCase().trim();
    if (!q) {
      return ALL_HTML_SUGGESTIONS.slice(0, 10);
    }
    const starts = ALL_HTML_SUGGESTIONS.filter(item => item.tag.toLowerCase().startsWith(q));
    const contains = ALL_HTML_SUGGESTIONS.filter(item => !item.tag.toLowerCase().startsWith(q) && item.tag.toLowerCase().includes(q));
    return [...starts, ...contains];
  });

  // Active Code Execution Outputs per code block id
  let codeOutputs = $state<Record<string, CodeRunOutput>>({});
  let runningBlockIds = $state<Record<string, boolean>>({});

  // Marked Configuration with forced target="_blank"
  marked.setOptions({
    gfm: true,
    breaks: true
  });

  const linkRenderer = {
    link({ href, title, text }: { href: string; title?: string | null; text: string }) {
      const titleAttr = title ? ` title="${title}"` : '';
      return `<a href="${href}" target="_blank" rel="noopener noreferrer"${titleAttr}>${text}</a>`;
    }
  };
  marked.use({ renderer: linkRenderer });

  // Render Markdown to HTML with GitHub alerts & safe external links
  let renderedHtml = $derived.by(() => {
    if (!section?.content) return '<p class="text-muted">This section is currently empty.</p>';

    try {
      let html = marked.parse(section.content) as string;

      // Force all <a> tags to target="_blank" rel="noopener noreferrer"
      html = html.replace(/<a\s+(?:[^>]*?\s+)?href="([^"]*)"([^>]*)>/gi, (match, href, rest) => {
        let cleaned = rest.replace(/target="[^"]*"/gi, '').replace(/rel="[^"]*"/gi, '').trim();
        return `<a href="${href}" target="_blank" rel="noopener noreferrer"${cleaned ? ' ' + cleaned : ''}>`;
      });

      html = html.replace(
        /<blockquote>\s*<p>\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*(?:<br\s*\/?>)?([\s\S]*?)<\/blockquote>/gi,
        (match, type, innerContent) => {
          const lower = type.toLowerCase();
          const titles: Record<string, string> = {
            note: 'NOTE',
            tip: 'TIP',
            important: 'IMPORTANT',
            warning: 'WARNING',
            caution: 'CAUTION'
          };
          const cleanBody = innerContent.trim().startsWith('<p>')
            ? innerContent.trim()
            : `<p>${innerContent.trim()}`;
          return `<div class="dokai-callout callout-${lower}">
            <div class="callout-header">
              <span class="callout-title">${titles[lower] || type}</span>
            </div>
            <div class="callout-body">${cleanBody}</div>
          </div>`;
        }
      );

      return html;
    } catch (e) {
      console.error('Markdown render error:', e);
      return `<p class="error-msg">Error rendering Markdown preview.</p>`;
    }
  });

  // Global Syntax Highlighter, Copy buttons & Multi-Language "Run Code" execution integration
  $effect(() => {
    if (renderedHtml && previewContainer) {
      setTimeout(() => {
        if (!previewContainer) return;

        // Auto-anchor headers for TOC links
        const headings = previewContainer.querySelectorAll('h1, h2, h3, h4, h5, h6');
        headings.forEach((h) => {
          if (!h.id) {
            const slug = (h.textContent || '')
              .toLowerCase()
              .replace(/[^\w\s-]/g, '')
              .replace(/\s+/g, '-');
            h.id = slug;
          }
        });

        // Global syntax highlighting & Code Runner Bar
        const codeBlocks = previewContainer.querySelectorAll('pre code');
        codeBlocks.forEach((block, index) => {
          if (!block.classList.contains('hljs-done')) {
            block.classList.add('hljs-done');

            const pre = block.parentElement;
            if (!pre) return;

            const detectedLang = highlightCodeElement(block as HTMLElement);

            if (!pre.querySelector('.code-actions-header')) {
              pre.style.position = 'relative';
              const blockId = `code-block-${index}`;

              // Create Action Bar Header for pre block
              const headerBar = document.createElement('div');
              headerBar.className = 'code-actions-header';

              // Language Tag
              const langTag = document.createElement('span');
              langTag.className = 'code-lang-tag';
              langTag.textContent = detectedLang.toUpperCase();
              headerBar.appendChild(langTag);

              // Buttons container
              const btnsWrap = document.createElement('div');
              btnsWrap.className = 'code-header-btns';

              // "Run Code" button for all runnable languages (built-in + on-demand compilers)
              if (isLanguageRunnable(detectedLang)) {
                const runBtn = document.createElement('button');
                runBtn.className = 'code-run-btn';
                runBtn.title = `Execute ${detectedLang.toUpperCase()} Code`;
                runBtn.innerHTML = `<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg><span>${t('editor.runCode', 'Run Code')}</span>`;
                runBtn.onclick = async () => {
                  const codeText = block.textContent || '';
                  runBtn.disabled = true;
                  runBtn.innerHTML = `<span class="run-spinner"></span><span>${t('editor.running', 'Running...')}</span>`;

                  try {
                    const result = await executeCode(codeText, detectedLang);
                    codeOutputs[blockId] = result;
                    renderOutputConsole(pre, blockId, result);
                  } catch (err: any) {
                    const errorResult: CodeRunOutput = {
                      success: false,
                      stdout: '',
                      stderr: err.message || 'Execution error',
                      exitCode: 1,
                      source: 'local-native'
                    };
                    codeOutputs[blockId] = errorResult;
                    renderOutputConsole(pre, blockId, errorResult);
                  } finally {
                    runBtn.disabled = false;
                    runBtn.innerHTML = `<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg><span>${t('editor.runCode', 'Run Code')}</span>`;
                  }
                };
                btnsWrap.appendChild(runBtn);
              }

              // "Copy Code" button
              const copyBtn = document.createElement('button');
              copyBtn.className = 'code-copy-btn';
              copyBtn.title = t('editor.copyCode', 'Copy Code');
              copyBtn.innerHTML = `<svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
              copyBtn.onclick = () => {
                navigator.clipboard.writeText(block.textContent || '');
                copyBtn.innerHTML = `<svg viewBox="0 0 24 24" width="13" height="13" stroke="#10b981" stroke-width="2.5" fill="none"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
                setTimeout(() => {
                  copyBtn.innerHTML = `<svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
                }, 2000);
              };
              btnsWrap.appendChild(copyBtn);

              headerBar.appendChild(btnsWrap);
              pre.insertBefore(headerBar, block);
            }
          }
        });
      }, 40);
    }
  });

  // Render Terminal Console Output Card under pre code (with Missing Toolchain Installer support)
  function renderOutputConsole(preEl: HTMLElement, blockId: string, output: CodeRunOutput) {
    let existingConsole = preEl.parentElement?.querySelector(`.code-console-${blockId}`);
    if (!existingConsole) {
      existingConsole = document.createElement('div');
      existingConsole.className = `code-console-output code-console-${blockId}`;
      preEl.insertAdjacentElement('afterend', existingConsole);
    }

    const durationText = output.executionTimeMs != null ? `${output.executionTimeMs}ms` : '';
    const statusText = output.missingToolchain
      ? t('runner.toolchainSetupRequired', 'Toolchain Setup Required')
      : output.success
        ? t('runner.success', 'Success')
        : `${t('runner.exitCode', 'Exit Code')}: ${output.exitCode ?? 1}`;
    const sourceLabel =
      output.source === 'local-native'
        ? t('runner.localNative', 'Local Native')
        : output.source === 'rust-playground'
          ? t('runner.rustPlayground', 'Rust Playground Sandbox')
          : t('runner.jsSandbox', 'JS Sandbox');

    const copyCmdLabel = t('runner.copyCmd', '📋 Copy Command');
    const copiedLabel = t('runner.copied', '✓ Copied!');
    const installWingetLabel = t('runner.installWinget', '⚡ Install via Winget');
    const launchingLabel = t('runner.launching', '⏳ Launching Terminal...');
    const launchedLabel = t('runner.launched', '✓ Installation Terminal Launched');
    const manualRunHintLabel = t('runner.manualRunHint', '⚠️ Please copy command and run in terminal');

    const toolchainSetupHtml = output.missingToolchain
      ? `
      <div class="toolchain-setup-box">
        <div class="toolchain-setup-info">
          <strong>📦 ${escapeHtml(output.toolchainName || 'Compiler / Runtime')} ${t('runner.setupRequired', 'Setup Required')}</strong>
          <span>${t('runner.setupDesc', 'Please install the required compiler or runtime for this language on your system.')}</span>
        </div>
        <div class="toolchain-setup-actions">
          ${
            output.installCommand
              ? `<button type="button" class="toolchain-copy-cmd-btn" title="Copy Install Command">${copyCmdLabel}</button>`
              : ''
          }
          ${
            output.wingetId
              ? `<button type="button" class="toolchain-install-btn" title="Launch Winget Installer">${installWingetLabel} (${escapeHtml(output.wingetId)})</button>`
              : ''
          }
        </div>
      </div>`
      : '';

    existingConsole.innerHTML = `
      <div class="console-header ${output.success ? 'success' : 'error'}">
        <div class="console-header-left">
          <span class="console-badge ${output.success ? 'badge-ok' : 'badge-err'}">${statusText}</span>
          <span class="console-source">${sourceLabel} ${durationText ? `• ${durationText}` : ''}</span>
        </div>
        <button type="button" class="console-close-btn" title="Close Console">✕</button>
      </div>
      <div class="console-body">
        ${output.stdout ? `<pre class="console-stdout">${escapeHtml(output.stdout)}</pre>` : ''}
        ${output.stderr ? `<pre class="console-stderr">${escapeHtml(output.stderr)}</pre>` : ''}
        ${!output.stdout && !output.stderr ? `<span class="console-empty">${t('runner.noOutput', 'Program finished with no terminal output.')}</span>` : ''}
        ${toolchainSetupHtml}
      </div>
    `;

    const closeBtn = existingConsole.querySelector('.console-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        existingConsole?.remove();
      });
    }

    const copyCmdBtn = existingConsole.querySelector('.toolchain-copy-cmd-btn');
    if (copyCmdBtn && output.installCommand) {
      copyCmdBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(output.installCommand || '');
        copyCmdBtn.textContent = copiedLabel;
        setTimeout(() => {
          copyCmdBtn.textContent = copyCmdLabel;
        }, 2000);
      });
    }

    const installBtn = existingConsole.querySelector('.toolchain-install-btn');
    if (installBtn && output.wingetId) {
      installBtn.addEventListener('click', async () => {
        installBtn.textContent = launchingLabel;
        const launched = await triggerToolchainInstall(output.wingetId!);
        installBtn.textContent = launched
          ? launchedLabel
          : manualRunHintLabel;
      });
    }
  }

  function escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // Helper to accurately locate caret pixel coordinates in textarea
  function getCaretCoordinates(element: HTMLTextAreaElement, position: number): { top: number; left: number } {
    const properties = [
      'direction',
      'boxSizing',
      'width',
      'height',
      'overflowX',
      'overflowY',
      'borderTopWidth',
      'borderRightWidth',
      'borderBottomWidth',
      'borderLeftWidth',
      'paddingTop',
      'paddingRight',
      'paddingBottom',
      'paddingLeft',
      'fontStyle',
      'fontVariant',
      'fontWeight',
      'fontStretch',
      'fontSize',
      'lineHeight',
      'fontFamily',
      'textAlign',
      'textTransform',
      'textIndent',
      'textDecoration',
      'letterSpacing',
      'wordSpacing',
      'tabSize'
    ] as const;

    const div = document.createElement('div');
    document.body.appendChild(div);

    const style = div.style;
    const computed = window.getComputedStyle(element);

    style.whiteSpace = 'pre-wrap';
    style.wordWrap = 'break-word';
    style.position = 'absolute';
    style.visibility = 'hidden';
    style.top = '0';
    style.left = '-9999px';

    properties.forEach(prop => {
      // @ts-ignore
      style[prop] = computed[prop];
    });

    div.textContent = element.value.substring(0, position);

    const span = document.createElement('span');
    span.textContent = element.value.substring(position) || '.';
    div.appendChild(span);

    const top = span.offsetTop + parseInt(computed.borderTopWidth || '0', 10) - element.scrollTop;
    const left = span.offsetLeft + parseInt(computed.borderLeftWidth || '0', 10) - element.scrollLeft;

    document.body.removeChild(div);
    return { top, left };
  }

  function calculateAutocompletePosition(textarea: HTMLTextAreaElement, pos: number) {
    try {
      const coords = getCaretCoordinates(textarea, pos);
      let top = coords.top + 26; // place right below cursor line
      let left = coords.left;

      const editorPane = textarea.parentElement;
      if (editorPane) {
        const paneHeight = editorPane.clientHeight;
        const paneWidth = editorPane.clientWidth;

        if (top + 230 > paneHeight) {
          top = Math.max(10, coords.top - 215);
        }
        if (left + 330 > paneWidth) {
          left = Math.max(16, paneWidth - 340);
        }
        left = Math.max(16, left);
        top = Math.max(10, top);
      }

      autocompleteCoords = { top, left };
    } catch (err) {
      console.warn('Caret calculation error:', err);
    }
  }

  /**
   * Inserts text using native browser commands to keep the native Undo/Redo (Ctrl+Z / Ctrl+Y) history intact.
   */
  function insertTextPreservingUndo(
    textarea: HTMLTextAreaElement,
    start: number,
    end: number,
    replacement: string,
    selectionOffsetStart?: number,
    selectionOffsetEnd?: number
  ) {
    textarea.focus();
    textarea.setSelectionRange(start, end);

    let success = false;
    try {
      // document.execCommand('insertText') natively updates the textarea and registers an undo entry
      success = document.execCommand('insertText', false, replacement);
    } catch {
      success = false;
    }

    if (!success) {
      textarea.setRangeText(replacement, start, end, 'end');
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }

    onUpdateContent(textarea.value);

    const s = selectionOffsetStart !== undefined ? selectionOffsetStart : (start + replacement.length);
    const e = selectionOffsetEnd !== undefined ? selectionOffsetEnd : s;
    setTimeout(() => {
      if (!textarea) return;
      textarea.focus();
      textarea.setSelectionRange(s, e);
    }, 0);
  }

  // Autocomplete Insertion Handler (preserves Ctrl+Z undo)
  function applyHtmlTag(item: HtmlSuggestion) {
    if (!editorTextarea || !section || autocompleteTriggerPos === null) return;

    const triggerPos = autocompleteTriggerPos;
    const cursorPos = editorTextarea.selectionStart;
    const insertedText = item.template.replace('$1', '');

    insertTextPreservingUndo(
      editorTextarea,
      triggerPos,
      cursorPos,
      insertedText,
      triggerPos + item.cursorOffset,
      triggerPos + item.cursorOffset
    );

    showAutocomplete = false;
    autocompleteQuery = '';
  }

  // Handle Input for Autocomplete Trigger & Dynamic Prefix Search
  function handleTextareaInput(e: Event) {
    const target = e.target as HTMLTextAreaElement;
    onUpdateContent(target.value);

    const cursorPos = target.selectionStart;
    const textBeforeCursor = target.value.substring(0, cursorPos);

    const lastOpenBracket = textBeforeCursor.lastIndexOf('<');
    const lastCloseBracket = textBeforeCursor.lastIndexOf('>');

    if (lastOpenBracket !== -1 && lastOpenBracket > lastCloseBracket) {
      const query = textBeforeCursor.substring(lastOpenBracket + 1);
      // Valid tag query: only alphanumeric and hyphens (no spaces, newlines, etc.)
      if (/^[a-zA-Z0-9-]*$/.test(query)) {
        autocompleteTriggerPos = lastOpenBracket;
        autocompleteQuery = query;
        showAutocomplete = true;
        selectedSuggestionIndex = 0;

        // Position popup right under caret
        calculateAutocompletePosition(target, lastOpenBracket);
        return;
      }
    }

    showAutocomplete = false;
    autocompleteQuery = '';
  }

  // Keyboard navigation for autocomplete & shortcuts
  function handleEditorKeyDown(e: KeyboardEvent) {
    if (showAutocomplete && filteredSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        selectedSuggestionIndex = (selectedSuggestionIndex + 1) % filteredSuggestions.length;
        return;
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        selectedSuggestionIndex = (selectedSuggestionIndex - 1 + filteredSuggestions.length) % filteredSuggestions.length;
        return;
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        applyHtmlTag(filteredSuggestions[selectedSuggestionIndex]);
        return;
      } else if (e.key === 'Escape') {
        e.preventDefault();
        showAutocomplete = false;
        return;
      }
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      copyFeedback = 'Auto-saved ✓';
      setTimeout(() => (copyFeedback = null), 1500);
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      insertFormat('**', '**', 'Bold text');
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') {
      e.preventDefault();
      insertFormat('*', '*', 'Italic text');
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      showFindBar = !showFindBar;
    }
  }

  function insertFormat(prefix: string, suffix: string = '', placeholder: string = '') {
    if (!editorTextarea || !section) return;

    const start = editorTextarea.selectionStart;
    const end = editorTextarea.selectionEnd;
    const selected = editorTextarea.value.substring(start, end) || placeholder;
    const replacement = prefix + selected + suffix;

    insertTextPreservingUndo(
      editorTextarea,
      start,
      end,
      replacement,
      start + prefix.length,
      start + prefix.length + selected.length
    );
  }

  function insertTable() {
    const tableTemplate = `\n| Header 1 | Header 2 | Header 3 |\n| :--- | :--- | :--- |\n| Value A | Value B | Value C |\n| Value D | Value E | Value F |\n\n`;
    insertFormat('', '', tableTemplate);
  }

  function insertCallout(type: 'NOTE' | 'TIP' | 'WARNING') {
    const template = `\n> [!${type}]\n> Enter explanation or alert note here.\n\n`;
    insertFormat('', '', template);
  }

  function insertCodeBlock() {
    const codeTemplate = `\n\`\`\`rust\n// Rust code snippet\nfn main() {\n    println!("DokAI");\n}\n\`\`\`\n\n`;
    insertFormat('', '', codeTemplate);
  }

  function formatCurrentMarkdown() {
    if (!editorTextarea || !section) return;
    const formatted = sanitizeSectionMarkdown(editorTextarea.value, section.title);
    if (formatted !== editorTextarea.value) {
      insertTextPreservingUndo(editorTextarea, 0, editorTextarea.value.length, formatted, 0, 0);
      copyFeedback = t('editor.markdownFormatted', 'Markdown Formatted ✓');
      setTimeout(() => (copyFeedback = null), 1800);
    } else {
      copyFeedback = t('editor.alreadyClean', 'Already Clean ✓');
      setTimeout(() => (copyFeedback = null), 1400);
    }
  }

  function handleFindNext() {
    if (!editorTextarea || !findQuery) return;
    const text = editorTextarea.value.toLowerCase();
    const q = findQuery.toLowerCase();
    const startPos = editorTextarea.selectionEnd || 0;
    let idx = text.indexOf(q, startPos);
    if (idx === -1) {
      idx = text.indexOf(q, 0);
    }
    if (idx !== -1) {
      editorTextarea.focus();
      editorTextarea.setSelectionRange(idx, idx + findQuery.length);
    }
  }

  function handleReplaceOne() {
    if (!editorTextarea || !findQuery) return;
    const s = editorTextarea.selectionStart;
    const e = editorTextarea.selectionEnd;
    const selected = editorTextarea.value.substring(s, e);
    if (selected.toLowerCase() === findQuery.toLowerCase()) {
      insertTextPreservingUndo(editorTextarea, s, e, replaceQuery, s, s + replaceQuery.length);
    } else {
      handleFindNext();
    }
  }

  function handleReplaceAll() {
    if (!editorTextarea || !findQuery) return;
    const escaped = findQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'gi');
    const updated = editorTextarea.value.replace(regex, replaceQuery);
    if (updated !== editorTextarea.value) {
      insertTextPreservingUndo(editorTextarea, 0, editorTextarea.value.length, updated);
      copyFeedback = t('editor.replacedAll', 'Replaced All ✓');
      setTimeout(() => (copyFeedback = null), 1600);
    }
  }
</script>

<div class="editor-preview-container">
  <!-- Toolbar -->
  <div class="toolbar">
    <div class="toolbar-left">
      <button
        class="icon-btn sidebar-toggle-btn"
        onclick={onToggleSidebar}
        title={isSidebarOpen ? t('toolbar.hideSidebar', 'Hide Sidebar') : t('toolbar.showSidebar', 'Show Sidebar')}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="9" y1="3" x2="9" y2="21"></line>
        </svg>
      </button>

      {#if section}
        <div class="current-section-badge">
          <span class="doc-crumb">{docTitle}</span>
          <span class="crumb-separator">/</span>
          <span class="section-crumb">{section.title}</span>
          {#if docAuthor}
            <span class="doc-author-badge" title="Author: {docAuthor}">👤 {docAuthor}</span>
          {/if}
        </div>
      {/if}
    </div>

    <!-- Formatting Tools -->
    {#if viewMode !== 'preview'}
      <div class="format-tools">
        <button class="fmt-btn" onclick={() => insertFormat('## ', '', 'Heading')} title={t('toolbar.h2Subheading', 'H2 Subheading')}>
          H2
        </button>
        <button class="fmt-btn" onclick={() => insertFormat('### ', '', 'Heading')} title={t('toolbar.h3Subheading', 'H3 Subheading')}>
          H3
        </button>
        <button class="fmt-btn" onclick={() => insertFormat('**', '**', 'Bold text')} title={t('toolbar.bold', 'Bold (Ctrl+B)')}>
          <strong>B</strong>
        </button>
        <button class="fmt-btn" onclick={() => insertFormat('*', '*', 'Italic text')} title={t('toolbar.italic', 'Italic (Ctrl+I)')}>
          <em>I</em>
        </button>
        <button class="fmt-btn" onclick={() => insertFormat('`', '`', 'code')} title={t('toolbar.inlineCode', 'Inline Code')}>
          `c`
        </button>
        <div class="fmt-divider"></div>
        <button class="fmt-btn" onclick={insertCodeBlock} title={t('toolbar.codeBlock', 'Code Block')}>
          &lt;/&gt;
        </button>
        <button class="fmt-btn" onclick={insertTable} title={t('toolbar.insertTable', 'Insert Table')}>
          <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="3" y1="9" x2="21" y2="9"></line>
            <line x1="3" y1="15" x2="21" y2="15"></line>
            <line x1="12" y1="3" x2="12" y2="21"></line>
          </svg>
        </button>
        <button class="fmt-btn" onclick={() => insertFormat('- ', '', 'List item')} title={t('toolbar.bulletList', 'Bullet List')}>
          ≡
        </button>
        <button class="fmt-btn" onclick={() => insertFormat('- [ ] ', '', 'Task item')} title={t('toolbar.taskChecklist', 'Task Checklist')}>
          ☑
        </button>
        <button class="fmt-btn" onclick={() => insertCallout('NOTE')} title={t('toolbar.calloutAlert', 'Callout Alert')}>
          💡
        </button>
        <div class="fmt-divider"></div>
        <button class="fmt-btn" onclick={formatCurrentMarkdown} title={t('toolbar.formatMarkdown', 'Clean & Format Markdown Syntax')}>
          ✨ {t('toolbar.formatMdBtn', 'Format MD')}
        </button>
        <button
          class="fmt-btn"
          class:active-fmt={showFindBar}
          onclick={() => (showFindBar = !showFindBar)}
          title={t('toolbar.findReplace', 'Find & Replace in Section (Ctrl+F)')}
        >
          🔍 {t('toolbar.findBtn', 'Find')}
        </button>
      </div>
    {/if}

    <!-- View Mode Toggles & Save Status -->
    <div class="toolbar-right">
      {#if copyFeedback}
        <span class="saved-indicator">{copyFeedback}</span>
      {/if}

      <div class="view-mode-toggle">
        <button
          class="mode-btn"
          class:active={viewMode === 'edit'}
          onclick={() => (viewMode = 'edit')}
          title={t('toolbar.editorOnly', 'Editor Only')}
        >
          {t('toolbar.editor', 'Editor')}
        </button>
        <button
          class="mode-btn"
          class:active={viewMode === 'split'}
          onclick={() => (viewMode = 'split')}
          title={t('toolbar.splitView', 'Dual Split View')}
        >
          {t('toolbar.split', 'Split')}
        </button>
        <button
          class="mode-btn"
          class:active={viewMode === 'preview'}
          onclick={() => (viewMode = 'preview')}
          title={t('toolbar.previewOnly', 'Live Preview Only')}
        >
          {t('toolbar.preview', 'Preview')}
        </button>
      </div>
    </div>
  </div>

  {#if showFindBar && viewMode !== 'preview'}
    <div class="find-replace-bar">
      <input
        type="text"
        bind:value={findQuery}
        placeholder={t('toolbar.findPlaceholder', 'Find in section...')}
        class="find-input"
        onkeydown={(e) => e.key === 'Enter' && handleFindNext()}
      />
      <input
        type="text"
        bind:value={replaceQuery}
        placeholder={t('toolbar.replacePlaceholder', 'Replace with...')}
        class="find-input"
        onkeydown={(e) => e.key === 'Enter' && handleReplaceOne()}
      />
      <button type="button" class="find-btn" onclick={handleFindNext}>{t('toolbar.findNext', 'Find Next')}</button>
      <button type="button" class="find-btn" onclick={handleReplaceOne}>{t('toolbar.replace', 'Replace')}</button>
      <button type="button" class="find-btn" onclick={handleReplaceAll}>{t('toolbar.replaceAll', 'Replace All')}</button>
      <button type="button" class="find-close" onclick={() => (showFindBar = false)} title={t('toolbar.closeFindBar', 'Close Find Bar')}>✕</button>
    </div>
  {/if}

  <!-- Workspace Panels -->
  <div class="workspace-panels" class:single={viewMode !== 'split'}>
    {#if section}
      {#if viewMode === 'split' || viewMode === 'edit'}
        <div class="editor-pane">
          <textarea
            bind:this={editorTextarea}
            value={section.content}
            oninput={handleTextareaInput}
            onkeydown={handleEditorKeyDown}
            onscroll={() => {
              if (showAutocomplete && editorTextarea && autocompleteTriggerPos !== null) {
                calculateAutocompletePosition(editorTextarea, autocompleteTriggerPos);
              }
            }}
            placeholder={t('editor.textareaPlaceholder', "Type your technical documentation in Markdown here... (Type '<' or start typing an HTML tag)")}
            class="markdown-textarea"
            spellcheck="false"
          ></textarea>

          <!-- HTML Tags Autocomplete Dropdown directly under caret position -->
          {#if showAutocomplete && filteredSuggestions.length > 0}
            <div
              class="html-autocomplete-popup"
              role="listbox"
              style="top: {autocompleteCoords.top}px; left: {autocompleteCoords.left}px;"
            >
              <div class="autocomplete-header">
                <div class="header-left">
                  <span class="ac-title">{t('editor.htmlAutocomplete', 'HTML Autocomplete')}</span>
                  {#if autocompleteQuery}
                    <span class="ac-query-tag">&lt;{autocompleteQuery}</span>
                  {/if}
                </div>
                <span class="ac-hint">[Tab] or [Enter]</span>
              </div>
              <div class="autocomplete-list">
                {#each filteredSuggestions as item, idx}
                  <button
                    type="button"
                    class="autocomplete-item"
                    class:selected={idx === selectedSuggestionIndex}
                    onclick={() => applyHtmlTag(item)}
                    role="option"
                    aria-selected={idx === selectedSuggestionIndex}
                  >
                    <span class="item-tag">{item.label}</span>
                    <span class="item-desc">{item.desc}</span>
                  </button>
                {/each}
              </div>
            </div>
          {/if}
        </div>
      {/if}

      {#if viewMode === 'split' || viewMode === 'preview'}
        <div class="preview-pane">
          <div class="markdown-body" bind:this={previewContainer}>
            {@html renderedHtml}
          </div>

          {#if onSelectSection && (prevSection || nextSection)}
            <nav class="section-pagination" aria-label="Section navigation">
              {#if prevSection}
                <button
                  type="button"
                  class="page-nav-card prev"
                  onclick={() => onSelectSection && onSelectSection(prevSection.id)}
                >
                  <span class="nav-dir">← Previous Section</span>
                  <span class="nav-title">{prevSection.title}</span>
                </button>
              {:else}
                <div></div>
              {/if}

              {#if nextSection}
                <button
                  type="button"
                  class="page-nav-card next"
                  onclick={() => onSelectSection && onSelectSection(nextSection.id)}
                >
                  <span class="nav-dir">Next Section →</span>
                  <span class="nav-title">{nextSection.title}</span>
                </button>
              {/if}
            </nav>
          {/if}
        </div>
      {/if}
    {:else}
      <div class="empty-selection">
        <div class="empty-card">
          <img src="/dokai_logo.svg" alt="DokAI" class="empty-icon" />
          <h3>{t('editor.noSectionSelected', 'No Section Selected')}</h3>
          <p>{t('editor.noSectionSelectedDesc', 'Select a section from the left sidebar or create a new document.')}</p>
        </div>
      </div>
    {/if}
  </div>

  <!-- Non-intrusive Editor Bottom Status Bar (Never overlaps text) -->
  <footer class="editor-bottom-bar">
    <div class="status-left">
      {#if section}
        <span class="status-sec-name">{t('editor.section')}: {section.title}</span>
        <span class="status-dot">•</span>
        <span class="status-words">{wordCount} {t('editor.words')}</span>
        <span class="status-dot">•</span>
        <span class="status-words">~{readingTimeMin} {t('editor.minRead')}</span>
      {/if}
    </div>

    <div class="status-right">
      {#if onOpenAiEnhance}
        <button
          type="button"
          class="status-action-btn status-enhance"
          onclick={onOpenAiEnhance}
          title={t('editor.enhanceTooltip', 'Enhance Active Section or Revise Full Document with AI')}
        >
          ✨ {t('editor.enhanceThisDoc', 'Enhance This Document')}
        </button>
      {/if}
      {#if onOpenDocAnalysis}
        <button
          type="button"
          class="status-action-btn status-audit"
          onclick={onOpenDocAnalysis}
          title={t('editor.auditTooltip', 'Audit Document Inaccuracies with AI')}
        >
          {t('editor.aiAudit', 'AI Audit')}
        </button>
      {/if}
    </div>
  </footer>
</div>

<style>
  .editor-preview-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    height: 100%;
    min-width: 0;
    overflow: hidden;
    background: var(--bg-surface);
    position: relative;
  }

  .toolbar {
    min-height: 40px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    padding: 4px 12px;
    background: var(--toolbar-bg);
    border-bottom: 1px solid var(--border-color);
    flex-shrink: 0;
    gap: 8px;
  }

  .toolbar-left {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    flex: 1 1 auto;
    overflow: hidden;
  }

  .sidebar-toggle-btn {
    width: 28px;
    height: 28px;
    flex-shrink: 0;
    border-radius: 5px;
    border: 1px solid var(--border-color);
    background: var(--btn-bg);
    color: var(--text-secondary);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .sidebar-toggle-btn:hover {
    background: var(--btn-hover-bg);
    color: var(--text-primary);
  }

  .current-section-badge {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12.5px;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .doc-crumb {
    color: var(--text-secondary);
    max-width: 140px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .crumb-separator {
    color: var(--text-secondary);
    opacity: 0.5;
  }

  .section-crumb {
    color: var(--text-primary);
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .doc-author-badge {
    font-size: 11px;
    color: var(--text-primary);
    background: rgba(16, 185, 129, 0.12);
    border: 1px solid rgba(16, 185, 129, 0.25);
    padding: 1px 7px;
    border-radius: 4px;
    margin-left: 6px;
    font-weight: 500;
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .format-tools {
    display: flex;
    align-items: center;
    gap: 3px;
    background: var(--btn-bg);
    padding: 2px 4px;
    border-radius: 6px;
    border: 1px solid var(--border-color);
    max-width: 100%;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .format-tools::-webkit-scrollbar {
    display: none;
  }

  .fmt-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 24px;
    min-width: 24px;
    padding: 0 5px;
    background: transparent;
    border: none;
    border-radius: 4px;
    color: var(--text-secondary);
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    flex-shrink: 0;
    transition: all 0.1s ease;
  }

  .fmt-btn:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .fmt-divider {
    width: 1px;
    height: 14px;
    background: var(--border-color);
    margin: 0 2px;
  }

  .toolbar-right {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
  }

  .saved-indicator {
    font-size: 11px;
    color: #10b981;
    font-weight: 500;
  }

  .view-mode-toggle {
    display: flex;
    background: var(--btn-bg);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    padding: 2px;
  }

  .mode-btn {
    border: none;
    background: transparent;
    font-size: 11.5px;
    padding: 3px 8px;
    border-radius: 4px;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .mode-btn:hover {
    color: var(--text-primary);
  }

  .mode-btn.active {
    background: var(--accent-color);
    color: #ffffff;
    font-weight: 600;
  }

  .workspace-panels {
    flex: 1;
    display: flex;
    overflow: hidden;
    position: relative;
  }

  .workspace-panels.single {
    display: block;
  }

  .editor-pane {
    flex: 1;
    height: 100%;
    display: flex;
    flex-direction: column;
    border-right: 1px solid var(--border-color);
    position: relative;
  }

  .markdown-textarea {
    width: 100%;
    height: 100%;
    border: none;
    outline: none;
    resize: none;
    padding: 20px 24px 60px 24px;
    font-family: 'JetBrains Mono', Consolas, 'Fira Code', Menlo, monospace;
    font-size: 13.5px;
    line-height: 1.6;
    background: var(--editor-bg);
    color: var(--text-primary);
    box-sizing: border-box;
  }

  /* HTML Autocomplete Popup directly anchored under caret */
  .html-autocomplete-popup {
    position: absolute;
    width: 320px;
    background: var(--bg-surface);
    border: 1px solid var(--accent-color);
    border-radius: 8px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
    z-index: 200;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    animation: fadeIn 0.12s ease-out;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .autocomplete-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 10px;
    background: var(--toolbar-bg);
    border-bottom: 1px solid var(--border-color);
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .ac-query-tag {
    font-family: 'JetBrains Mono', Consolas, monospace;
    font-size: 10px;
    background: var(--accent-subtle);
    color: var(--accent-color);
    padding: 1px 5px;
    border-radius: 4px;
    font-weight: 600;
  }

  .ac-title {
    font-size: 11px;
    font-weight: 700;
    color: var(--accent-color);
    letter-spacing: 0.3px;
  }

  .ac-hint {
    font-size: 10px;
    color: var(--text-secondary);
  }

  .autocomplete-list {
    display: flex;
    flex-direction: column;
    padding: 4px;
    max-height: 220px;
    overflow-y: auto;
  }

  .autocomplete-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 10px;
    background: transparent;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    text-align: left;
    transition: all 0.1s ease;
  }

  .autocomplete-item:hover,
  .autocomplete-item.selected {
    background: var(--accent-subtle);
  }

  .item-tag {
    font-family: 'JetBrains Mono', Consolas, monospace;
    font-size: 12.5px;
    font-weight: 700;
    color: var(--accent-color);
  }

  .item-desc {
    font-size: 11px;
    color: var(--text-secondary);
  }

  .preview-pane {
    flex: 1;
    height: 100%;
    overflow-y: auto;
    padding: 24px 36px 60px 36px;
    background: var(--preview-bg);
    box-sizing: border-box;
  }

  /* Pre block Header Bar */
  :global(.code-actions-header) {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 12px;
    background: rgba(15, 23, 42, 0.75);
    border-bottom: 1px solid var(--border-color);
    border-top-left-radius: 8px;
    border-top-right-radius: 8px;
    margin: -14px -16px 10px -16px;
  }

  :global(.code-lang-tag) {
    font-size: 10.5px;
    font-weight: 700;
    font-family: 'JetBrains Mono', Consolas, monospace;
    color: var(--accent-color);
    letter-spacing: 0.5px;
  }

  :global(.code-header-btns) {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  :global(.code-run-btn) {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 3px 8px;
    border-radius: 4px;
    border: 1px solid rgba(16, 185, 129, 0.4);
    background: rgba(16, 185, 129, 0.12);
    color: #10b981;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  :global(.code-run-btn:hover:not(:disabled)) {
    background: #10b981;
    color: #ffffff;
    box-shadow: 0 0 8px rgba(16, 185, 129, 0.4);
  }

  :global(.code-run-btn:disabled) {
    opacity: 0.6;
    cursor: not-allowed;
  }

  :global(.run-spinner) {
    width: 10px;
    height: 10px;
    border: 1.5px solid currentColor;
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }

  :global(.code-copy-btn) {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 4px;
    border: 1px solid var(--border-color);
    background: var(--btn-bg);
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  :global(.code-copy-btn:hover) {
    background: var(--btn-hover-bg);
    color: var(--text-primary);
  }

  /* Interactive Terminal Console Output */
  :global(.code-console-output) {
    margin-top: -10px;
    margin-bottom: 18px;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    background: #090d16;
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
    overflow: hidden;
  }

  :global(.console-header) {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 12px;
    background: rgba(15, 23, 42, 0.9);
    border-bottom: 1px solid var(--border-color);
    font-size: 11px;
  }

  :global(.console-header-left) {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  :global(.console-badge) {
    font-weight: 700;
    padding: 1px 6px;
    border-radius: 3px;
    font-size: 10px;
  }

  :global(.console-badge.badge-ok) {
    background: rgba(16, 185, 129, 0.2);
    color: #10b981;
  }

  :global(.console-badge.badge-err) {
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
  }

  :global(.console-source) {
    color: var(--text-secondary);
    font-size: 10.5px;
  }

  :global(.console-close-btn) {
    background: transparent;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    font-size: 11px;
    padding: 0;
  }

  :global(.console-close-btn:hover) {
    color: var(--text-primary);
  }

  :global(.console-body) {
    padding: 10px 14px;
    font-family: 'JetBrains Mono', Consolas, monospace;
    font-size: 12px;
    max-height: 200px;
    overflow-y: auto;
  }

  :global(.console-stdout) {
    color: #38bdf8;
    margin: 0;
    white-space: pre-wrap;
    background: transparent !important;
    padding: 0 !important;
    border: none !important;
  }

  :global(.console-stderr) {
    color: #f87171;
    margin: 4px 0 0 0;
    white-space: pre-wrap;
    background: transparent !important;
    padding: 0 !important;
    border: none !important;
  }

  :global(.console-empty) {
    color: var(--text-secondary);
    font-style: italic;
    font-size: 11.5px;
  }

  :global(.markdown-body) {
    color: var(--text-primary);
    line-height: 1.7;
    font-size: 14.5px;
    max-width: 900px;
    margin: 0 auto;
  }

  :global(.markdown-body h1) {
    font-size: 26px;
    font-weight: 800;
    margin-top: 0;
    margin-bottom: 16px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--border-color);
    color: var(--text-primary);
    letter-spacing: -0.5px;
  }

  :global(.markdown-body h2) {
    font-size: 20px;
    font-weight: 700;
    margin-top: 28px;
    margin-bottom: 12px;
    padding-bottom: 6px;
    border-bottom: 1px solid var(--border-color);
    color: var(--text-primary);
    letter-spacing: -0.3px;
  }

  :global(.markdown-body h3) {
    font-size: 16px;
    font-weight: 600;
    margin-top: 20px;
    margin-bottom: 8px;
    color: var(--text-primary);
  }

  :global(.markdown-body h4) {
    font-size: 14px;
    font-weight: 600;
    margin-top: 16px;
    margin-bottom: 6px;
    color: var(--text-primary);
  }

  :global(.markdown-body p) {
    margin-top: 0;
    margin-bottom: 14px;
    color: var(--text-primary);
  }

  :global(.markdown-body hr) {
    border: none;
    border-top: 1px solid var(--border-color);
    margin: 24px 0;
  }

  :global(.markdown-body ul, .markdown-body ol) {
    padding-left: 24px;
    margin-bottom: 16px;
  }

  :global(.markdown-body li) {
    margin-bottom: 6px;
  }

  :global(.markdown-body table) {
    width: 100%;
    border-collapse: collapse;
    margin: 16px 0;
    font-size: 13.5px;
  }

  :global(.markdown-body th, .markdown-body td) {
    border: 1px solid var(--border-color);
    padding: 8px 12px;
    text-align: left;
  }

  :global(.markdown-body th) {
    background: var(--bg-hover);
    font-weight: 600;
  }

  :global(.markdown-body code:not(pre code)) {
    background: var(--code-inline-bg);
    color: var(--accent-color);
    font-family: 'JetBrains Mono', Consolas, monospace;
    font-size: 12.5px;
    padding: 2px 6px;
    border-radius: 4px;
  }

  :global(.markdown-body pre) {
    background: var(--code-block-bg);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 14px 16px;
    overflow-x: auto;
    margin: 16px 0;
    font-size: 13px;
    line-height: 1.5;
  }

  :global(.markdown-body pre code) {
    font-family: 'JetBrains Mono', Consolas, monospace;
    background: transparent !important;
    padding: 0 !important;
  }

  :global(.dokai-callout) {
    border-left: 4px solid #6366f1;
    background: rgba(99, 102, 241, 0.08);
    border-radius: 6px;
    padding: 10px 14px;
    margin: 16px 0;
  }

  :global(.dokai-callout.callout-tip) {
    border-left-color: #10b981;
    background: rgba(16, 185, 129, 0.08);
  }

  :global(.dokai-callout.callout-warning) {
    border-left-color: #f59e0b;
    background: rgba(245, 158, 11, 0.08);
  }

  :global(.dokai-callout.callout-important) {
    border-left-color: #8b5cf6;
    background: rgba(139, 92, 246, 0.08);
  }

  :global(.callout-header) {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.6px;
    margin-bottom: 4px;
  }

  :global(.callout-note .callout-header) { color: #6366f1; }
  :global(.callout-tip .callout-header) { color: #10b981; }
  :global(.callout-warning .callout-header) { color: #f59e0b; }
  :global(.callout-important .callout-header) { color: #8b5cf6; }

  :global(.callout-body p) {
    margin: 0;
    font-size: 13.5px;
  }

  :global(.markdown-body kbd) {
    display: inline-block;
    padding: 2px 6px;
    font-family: 'JetBrains Mono', Consolas, monospace;
    font-size: 11px;
    line-height: 1.4;
    color: var(--text-primary);
    background-color: var(--btn-bg);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    box-shadow: inset 0 -1px 0 var(--border-color);
  }

  :global(.markdown-body mark) {
    background: rgba(234, 179, 8, 0.25);
    color: var(--text-primary);
    padding: 1px 4px;
    border-radius: 3px;
  }

  :global(.markdown-body details) {
    background: var(--input-bg);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    padding: 10px 14px;
    margin: 14px 0;
  }

  :global(.markdown-body summary) {
    font-weight: 600;
    cursor: pointer;
    color: var(--accent-color);
  }

  .empty-selection {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .empty-card {
    text-align: center;
    max-width: 320px;
  }

  .empty-icon {
    width: 64px;
    height: 64px;
    margin-bottom: 12px;
    opacity: 0.8;
  }

  .empty-card h3 {
    margin: 0 0 6px 0;
    font-size: 16px;
    color: var(--text-primary);
  }

  .empty-card p {
    font-size: 13px;
    color: var(--text-secondary);
    margin: 0;
  }

  /* Non-intrusive Editor Bottom Status Bar */
  .editor-bottom-bar {
    min-height: 30px;
    background: var(--toolbar-bg);
    border-top: 1px solid var(--border-color);
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 8px;
    padding: 3px 14px;
    font-size: 11.5px;
    color: var(--text-secondary);
    flex-shrink: 0;
    z-index: 10;
  }

  .status-left {
    display: flex;
    align-items: center;
    gap: 8px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }

  .status-sec-name {
    color: var(--text-primary);
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .status-dot {
    opacity: 0.4;
  }

  .status-words {
    opacity: 0.75;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .status-right {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
    flex-shrink: 0;
  }

  .status-action-btn {
    background: transparent;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    color: var(--text-secondary);
    font-size: 11px;
    font-weight: 500;
    padding: 2px 8px;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.15s ease;
  }

  .status-action-btn:hover {
    color: var(--text-primary);
    background: var(--btn-hover-bg);
    border-color: var(--border-hover-color);
  }

  .status-action-btn.status-enhance:hover {
    color: #a5b4fc;
    border-color: rgba(99, 102, 241, 0.5);
    background: rgba(99, 102, 241, 0.15);
  }


  .status-action-btn.status-audit:hover {
    color: #38bdf8;
    border-color: rgba(56, 189, 248, 0.5);
    background: rgba(56, 189, 248, 0.15);
  }

  /* Missing Toolchain / Compiler Prompt inside Code Output Console */
  :global(.console-badge.badge-warn) {
    background: rgba(245, 158, 11, 0.2);
    color: #fbbf24;
  }

  :global(.toolchain-setup-box) {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px 12px;
    background: rgba(245, 158, 11, 0.08);
    border: 1px solid rgba(245, 158, 11, 0.35);
    border-radius: 6px;
  }

  :global(.toolchain-msg) {
    margin: 0;
    color: #fde68a;
    font-size: 12px;
    line-height: 1.45;
  }

  :global(.toolchain-cmd-row) {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  :global(.toolchain-cmd-code) {
    font-family: 'JetBrains Mono', Consolas, monospace;
    font-size: 11.5px;
    padding: 4px 8px;
    background: rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 4px;
    color: #38bdf8;
  }

  :global(.toolchain-copy-cmd-btn),
  :global(.toolchain-install-btn) {
    padding: 4px 10px;
    border-radius: 5px;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  :global(.toolchain-copy-cmd-btn) {
    background: var(--btn-bg);
    border: 1px solid var(--border-color);
    color: var(--text-primary);
  }

  :global(.toolchain-copy-cmd-btn:hover) {
    background: var(--btn-hover-bg);
  }

  :global(.toolchain-install-btn) {
    background: rgba(16, 185, 129, 0.18);
    border: 1px solid rgba(16, 185, 129, 0.45);
    color: #34d399;
  }

  :global(.toolchain-install-btn:hover:not(:disabled)) {
    background: #10b981;
    color: #ffffff;
  }

  .fmt-btn.active-fmt {
    background: var(--accent-subtle);
    color: var(--accent-color);
  }

  .find-replace-bar {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    padding: 6px 14px;
    background: var(--toolbar-bg);
    border-bottom: 1px solid var(--border-color);
    flex-shrink: 0;
  }

  .find-input {
    width: 170px;
    max-width: 100%;
    padding: 4px 10px;
    font-size: 12px;
    border-radius: 5px;
    border: 1px solid var(--border-color);
    background: var(--input-bg);
    color: var(--text-primary);
    outline: none;
  }

  .find-input:focus {
    border-color: var(--accent-color);
  }

  .find-btn {
    padding: 4px 10px;
    font-size: 11px;
    font-weight: 600;
    border-radius: 5px;
    border: 1px solid var(--border-color);
    background: var(--btn-bg);
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.12s ease;
  }

  .find-btn:hover {
    background: var(--btn-hover-bg);
    color: var(--text-primary);
  }

  .find-close {
    margin-left: auto;
    background: transparent;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    font-size: 12px;
    padding: 2px 6px;
    border-radius: 4px;
  }

  .find-close:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  :global(.dokai-callout.callout-caution) {
    border-left-color: #ef4444;
    background: rgba(239, 68, 68, 0.08);
  }

  :global(.callout-caution .callout-header) {
    color: #ef4444;
  }

  .section-pagination {
    max-width: 900px;
    margin: 40px auto 12px auto;
    padding-top: 20px;
    border-top: 1px solid var(--border-color);
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 14px;
  }

  .page-nav-card {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 12px 16px;
    border-radius: 8px;
    border: 1px solid var(--border-color);
    background: var(--btn-bg);
    cursor: pointer;
    transition: all 0.15s ease;
    text-align: left;
  }

  .page-nav-card.next {
    text-align: right;
  }

  .page-nav-card:hover {
    border-color: var(--accent-color);
    background: var(--accent-subtle);
  }

  .nav-dir {
    font-size: 10.5px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-secondary);
  }

  .nav-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
  }

  @media (max-width: 960px) {
    .workspace-panels:not(.single) {
      flex-direction: column;
    }
    .editor-pane {
      border-right: none;
      border-bottom: 1px solid var(--border-color);
      height: 50%;
    }
    .preview-pane {
      height: 50%;
      padding: 18px 20px 44px 20px;
    }
  }

  @media (max-width: 768px) {
    .preview-pane {
      padding: 14px 16px 40px 16px;
    }
    .markdown-textarea {
      padding: 14px;
    }
    .doc-crumb,
    .crumb-separator,
    .doc-author-badge {
      display: none;
    }
  }
</style>
