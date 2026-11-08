import type { DocSection, IssueSeverity } from '../types';

/**
 * DokAI Markdown protocol.
 *
 * Instead of asking models to embed long Markdown inside JSON strings (which breaks on
 * quotes/backslashes in code samples and makes smaller models leak keys like `id:` and
 * `title:` into the content), documents are exchanged in a plain-text delimiter format:
 *
 *   <<<DOC_META>>>
 *   title: ...
 *   description: ...
 *   tags: a, b, c
 *   <<<SECTION: Overview>>>
 *   ## Overview
 *   ...markdown...
 *   <<<SECTION: Installation>>>
 *   ...
 *   <<<END>>>
 *
 * Every piece of Markdown that comes back from a model is passed through
 * `normalizeMarkdown` so the editor always receives clean, renderer-friendly GFM.
 */

export type DocDepth = 'concise' | 'standard' | 'in_depth';
export type OutputLanguage = string;

const KNOWN_LANGUAGES: Record<string, string> = {
  auto: 'the same language as the user input (default to English if unclear)',
  en: 'English',
  tr: 'Turkish (Türkçe)',
  de: 'German (Deutsch)',
  es: 'Spanish (Español)',
  fr: 'French (Français)',
  it: 'Italian (Italiano)',
  pt: 'Portuguese (Português)',
  ru: 'Russian (Русский)',
  ja: 'Japanese (日本語)',
  zh: 'Chinese (中文)',
  ko: 'Korean (한국어)',
  nl: 'Dutch (Nederlands)',
  pl: 'Polish (Polski)',
  uk: 'Ukrainian (Українська)',
  ar: 'Arabic (العربية)'
};

export function getLanguageName(code: string): string {
  if (!code || code === 'auto') return 'the same language as the user input (default to English if unclear)';
  const lower = code.toLowerCase();
  return KNOWN_LANGUAGES[lower] || `the language corresponding to locale code "${code}"`;
}

export const LANGUAGE_NAMES: Record<string, string> = new Proxy(
  KNOWN_LANGUAGES,
  {
    get: (target: Record<string, string>, prop: string) => target[prop] || getLanguageName(prop)
  }
);

export const DEPTH_SPEC: Record<DocDepth, { sections: string; words: string }> = {
  concise: { sections: '4-5', words: '150-300' },
  standard: { sections: '6-8', words: '300-600' },
  in_depth: { sections: '8-10', words: '500-900' }
};

export function buildMarkdownStyleGuide(language: OutputLanguage = 'auto'): string {
  return `MARKDOWN OUTPUT RULES (the DokAI renderer supports GitHub-Flavored Markdown, global syntax highlighting, interactive code execution, and GitHub alerts):
1. Output raw Markdown only. NEVER wrap the answer in a \`\`\`markdown fence. NEVER output JSON, YAML front-matter, or keys such as "id:", "title:", "slug:", "order:", "content:".
2. Headings: a section starts with exactly one "## <Section Title>" line. Inside a section use "###" and "####" only, never skip levels and never use a single "#". Put a blank line before and after every heading. No emojis in headings.
3. Code: ALWAYS use fenced code blocks with an explicit language tag (\`\`\`rust, \`\`\`javascript, \`\`\`typescript, \`\`\`powershell, \`\`\`cmd, \`\`\`cpp, \`\`\`c, \`\`\`python, \`\`\`go, \`\`\`bash, \`\`\`json, \`\`\`yaml, \`\`\`sql, \`\`\`html, \`\`\`css). Code must be complete, syntactically valid, self-contained, and directly runnable via the "Run Code" button (include main function or top-level statements that print clear output). Never use "..." placeholders inside code. Show expected output in a separate \`\`\`text block when helpful. Use \`inline code\` for identifiers, file names, commands and values.
4. Tables: GFM pipe tables with a header row and a separator row (| :--- | :--- |); every row must have the same number of columns; blank line before and after the table.
5. Callouts use GitHub alert syntax as a blockquote, the marker on its own line:
> [!NOTE]
> Explanation text.
Allowed markers: NOTE, TIP, IMPORTANT, WARNING, CAUTION. Use them sparingly (1-2 per section) for genuinely important information.
6. Lists: "-" for bullet points, "1." for sequential steps; blank line before and after each list. Keep bullets parallel and concise.
7. Architecture & Flows: Represent component topologies, pipelines, or data flows using clean GFM tables, numbered step flows, or structured \`\`\`text ASCII diagrams. Do NOT use mermaid blocks.
8. Links: only real, stable URLs (official documentation). Never invent URLs or link to "#" anchors.
9. Avoid raw HTML except <kbd> or <details>/<summary> when truly useful.
10. Accuracy first: describe current stable versions/APIs, mention version-specific behaviour, never fabricate APIs, flags or configuration keys. If something is uncertain, say so explicitly.
11. Write all prose in ${LANGUAGE_NAMES[language]}. Keep code identifiers and keywords in English.`;
}

export const DOC_FORMAT_SPEC = `RESPONSE FORMAT (plain text, NOT JSON). Use these exact delimiter lines, each on its own line:
<<<DOC_META>>>
title: <document title>
description: <one or two sentence summary>
tags: <comma separated lowercase tags>
<<<SECTION: <Section Title>>>
## <Section Title>

<markdown content of the section>
<<<SECTION: <Next Section Title>>>
## <Next Section Title>

<markdown content>
<<<END>>>

Do not put anything before <<<DOC_META>>> or after <<<END>>>. Section titles must not be numbered (no "1." prefix).`;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

export function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/ı/g, 'i')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-') || 'section'
  );
}

const FENCE_RE = /^\s{0,3}(`{3,}|~{3,})(.*)$/;

/** Iterates lines while tracking whether we are inside a fenced code block. */
function mapLinesOutsideFences(
  lines: string[],
  fn: (line: string, index: number, inFence: boolean, isFenceLine: boolean) => string | string[]
): string[] {
  const out: string[] = [];
  let fenceMarker: string | null = null;
  lines.forEach((line, idx) => {
    const m = line.match(FENCE_RE);
    let isFenceLine = false;
    if (m) {
      const marker = m[1];
      if (fenceMarker === null) {
        fenceMarker = marker[0].repeat(marker.length);
        isFenceLine = true;
      } else if (marker[0] === fenceMarker[0] && marker.length >= fenceMarker.length && !m[2].trim()) {
        isFenceLine = true;
        const res = fn(line, idx, true, true);
        fenceMarker = null;
        out.push(...(Array.isArray(res) ? res : [res]));
        return;
      }
    }
    const res = fn(line, idx, fenceMarker !== null && !isFenceLine, isFenceLine);
    out.push(...(Array.isArray(res) ? res : [res]));
  });
  return out;
}

/** If the model double-escaped the content ("\\n" instead of real newlines), unescape it. */
function unescapeIfDoubleEscaped(text: string): string {
  const realNewlines = (text.match(/\n/g) || []).length;
  const literalNewlines = (text.match(/\\n/g) || []).length;
  if (literalNewlines >= 3 && realNewlines < literalNewlines / 4) {
    return text
      .replace(/\\r\\n/g, '\n')
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\');
  }
  return text;
}

const LEAKED_KEY_RE =
  /^\s*["']?(?:id|title|slug|order|section_?id|sectionId|section_title|content|markdown)["']?\s*[:=]\s*(?:"[^"\n]*"|'[^'\n]*'|[^\n]*?),?\s*$/i;

/**
 * Cleans any Markdown produced by an AI model so it renders correctly in DokAI.
 */
export function normalizeMarkdown(raw: string, options: { allowH1?: boolean } = {}): string {
  if (!raw || typeof raw !== 'string') return '';
  let text = unescapeIfDoubleEscaped(raw.replace(/\r\n?/g, '\n')).trim();

  // Unwrap a fence wrapping the entire answer (```markdown ... ```)
  const outer = text.match(/^```(?:markdown|md|mdx|text)?[ \t]*\n([\s\S]*?)\n```\s*$/i);
  if (outer && !outer[1].includes('\n```\n```')) text = outer[1].trim();

  // Embedded JSON object {"content": "..."}
  if (text.startsWith('{') && text.endsWith('}')) {
    try {
      const parsed = JSON.parse(text);
      const inner = parsed?.content ?? parsed?.markdown;
      if (typeof inner === 'string') text = unescapeIfDoubleEscaped(inner).trim();
    } catch {
      /* not JSON */
    }
  }

  // Strip YAML front-matter
  text = text.replace(/^---\n[\s\S]*?\n---\n*/, '');

  // Strip leaked delimiter lines & metadata lines at the top
  text = text.replace(/^<<<\s*(?:DOC_META|SECTION:[^>]*|END)\s*>>>\s*$/gim, '');
  let lines = text.split('\n');
  while (lines.length && (LEAKED_KEY_RE.test(lines[0]) || !lines[0].trim())) {
    // Keep "title:" lines only if they look like prose (very long) – unlikely to be metadata
    if (lines[0].trim().length > 160) break;
    lines.shift();
  }

  // Remove trailing JSON artifacts
  while (lines.length && /^\s*["']?\s*[}\]],?\s*$/.test(lines[lines.length - 1])) lines.pop();

  let firstContentLine = true;
  lines = mapLinesOutsideFences(lines, (line, _idx, inFence, isFenceLine) => {
    if (inFence) return line;
    if (isFenceLine) {
      firstContentLine = false;
      return line.replace(/^\s{0,3}/, '');
    }

    let l = line.replace(/\s+$/, '');

    // Bare GitHub alert markers -> blockquote
    const bareAlert = l.match(/^\s*\[!(note|tip|important|warning|caution)\]\s*(.*)$/i);
    if (bareAlert) {
      const rest = bareAlert[2].trim();
      l = `> [!${bareAlert[1].toUpperCase()}]` + (rest ? `\n> ${rest}` : '');
    }
    // Normalise alert marker casing / map common aliases
    l = l.replace(/^(\s*>\s*)\[!(\w+)\]/i, (_m, prefix, type) => {
      const t = String(type).toUpperCase();
      const alias: Record<string, string> = { INFO: 'NOTE', HINT: 'TIP', DANGER: 'CAUTION', ERROR: 'CAUTION', ATTENTION: 'WARNING' };
      return `${prefix}[!${alias[t] || t}]`;
    });

    // Headings: ensure space after #, demote H1 inside sections
    const heading = l.match(/^(#{1,6})([^#\s].*)$/);
    if (heading) l = `${heading[1]} ${heading[2]}`;
    if (!options.allowH1 && /^#\s/.test(l) && !firstContentLine) l = '#' + l;

    if (l.trim()) firstContentLine = false;
    return l;
  });

  // Ensure blank lines around headings and before fences / tables / alerts
  const spaced: string[] = [];
  let fenceOpen = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const prev = spaced.length ? spaced[spaced.length - 1] : '';
    const isFence = FENCE_RE.test(line);

    if (!fenceOpen) {
      const isHeading = /^#{1,6}\s/.test(line);
      const isTableStart = /^\|.*\|\s*$/.test(line) && !/^\|.*\|\s*$/.test(prev);
      const isAlertStart = /^>\s*\[!/.test(line);
      if ((isHeading || isFence || isTableStart || isAlertStart) && prev.trim() !== '' && spaced.length) {
        spaced.push('');
      }
      spaced.push(line);
      if (isHeading && lines[i + 1] !== undefined && lines[i + 1].trim() !== '') spaced.push('');
    } else {
      spaced.push(line);
    }

    if (isFence) {
      fenceOpen = !fenceOpen;
      if (!fenceOpen && lines[i + 1] !== undefined && lines[i + 1].trim() !== '') spaced.push('');
    }
  }
  if (fenceOpen) spaced.push('```');

  text = spaced.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return text;
}

/** Ensures a section begins with a `## Title` heading (unless it already starts with a heading). */
export function ensureSectionHeading(content: string, title: string): string {
  const trimmed = content.trim();
  if (!trimmed) return `## ${title}\n\n_This section has no content yet._`;
  if (/^#{1,3}\s/.test(trimmed)) return trimmed;
  return `## ${title}\n\n${trimmed}`;
}

/** Removes numbering like "1. ", "Section 2: " from titles. */
export function cleanSectionTitle(title: string, fallback: string): string {
  const cleaned = (title || '')
    .replace(/^#+\s*/, '')
    .replace(/^(?:section\s+\d+\s*[:.\-–]\s*|\d+(?:\.\d+)*[.)]?\s+)/i, '')
    .replace(/[*_`]/g, '')
    .trim();
  return cleaned || fallback;
}

export function buildSection(title: string, content: string, order: number, idPrefix = 'sec'): DocSection {
  const cleanTitle = cleanSectionTitle(title, `Section ${order}`);
  return {
    id: `${idPrefix}-${Date.now().toString(36)}-${order}-${Math.random().toString(36).slice(2, 6)}`,
    title: cleanTitle,
    slug: slugify(cleanTitle),
    order,
    content: ensureSectionHeading(normalizeMarkdown(content), cleanTitle)
  };
}

/* ------------------------------------------------------------------ */
/* Parsers                                                             */
/* ------------------------------------------------------------------ */

export interface ParsedDocument {
  title?: string;
  description?: string;
  tags?: string[];
  sections: DocSection[];
}

const SECTION_DELIM_RE = /^\s*(?:<{2,3}|={3})\s*SECTION\s*[:\-]\s*(.+?)\s*(?:>{2,3}|={3})\s*$/i;
const META_DELIM_RE = /^\s*(?:<{2,3}|={3})\s*DOC_META\s*(?:>{2,3}|={3})\s*$/i;
const END_DELIM_RE = /^\s*(?:<{2,3}|={3})\s*END\s*(?:>{2,3}|={3})\s*$/i;

/** Parses the delimiter protocol. Returns null if no section delimiters were found. */
export function parseDelimitedDocument(raw: string): ParsedDocument | null {
  const text = unescapeIfDoubleEscaped(raw.replace(/\r\n?/g, '\n'));
  const lines = text.split('\n');
  if (!lines.some(l => SECTION_DELIM_RE.test(l))) return null;

  const meta: Record<string, string> = {};
  const rawSections: Array<{ title: string; lines: string[] }> = [];
  let mode: 'pre' | 'meta' | 'section' | 'end' = 'pre';
  let inFence = false;

  for (const line of lines) {
    if (FENCE_RE.test(line)) inFence = !inFence;
    if (!inFence || mode !== 'section') {
      if (META_DELIM_RE.test(line)) {
        mode = 'meta';
        continue;
      }
      const sec = line.match(SECTION_DELIM_RE);
      if (sec) {
        inFence = false;
        mode = 'section';
        rawSections.push({ title: sec[1], lines: [] });
        continue;
      }
      if (END_DELIM_RE.test(line)) {
        mode = 'end';
        continue;
      }
    }
    if (mode === 'meta') {
      const kv = line.match(/^\s*(\w+)\s*:\s*(.*)$/);
      if (kv) meta[kv[1].toLowerCase()] = kv[2].trim();
    } else if (mode === 'section' && rawSections.length) {
      rawSections[rawSections.length - 1].lines.push(line);
    }
  }

  const sections = rawSections
    .filter(s => s.lines.join('').trim().length > 0)
    .map((s, i) => buildSection(s.title, s.lines.join('\n'), i + 1));

  if (!sections.length) return null;

  return {
    title: meta.title?.replace(/^["']|["']$/g, ''),
    description: meta.description?.replace(/^["']|["']$/g, ''),
    tags: meta.tags
      ? meta.tags
          .split(',')
          .map(t => t.trim().toLowerCase().replace(/^#/, ''))
          .filter(Boolean)
          .slice(0, 8)
      : undefined,
    sections
  };
}

/**
 * Fallback parser for a plain Markdown answer: splits on `## ` headings (ignoring code fences).
 */
export function parseSectionsFromMarkdown(rawMarkdown: string, fallbackTitle: string): DocSection[] {
  const text = normalizeMarkdown(rawMarkdown, { allowH1: true });
  const lines = text.split('\n');
  const chunks: Array<{ title: string; lines: string[] }> = [];
  let current: { title: string; lines: string[] } = { title: '', lines: [] };
  let inFence = false;

  for (const line of lines) {
    if (FENCE_RE.test(line)) inFence = !inFence;
    const h2 = !inFence && line.match(/^##\s+(.+)$/);
    if (h2) {
      if (current.title || current.lines.join('').trim()) chunks.push(current);
      current = { title: h2[1], lines: [line] };
    } else {
      current.lines.push(line);
    }
  }
  if (current.title || current.lines.join('').trim()) chunks.push(current);

  // Merge a short H1-only preamble into the first real section
  if (chunks.length > 1 && !chunks[0].title && chunks[0].lines.join('\n').trim().length < 400) {
    const preamble = chunks.shift()!;
    chunks[0].lines = [...preamble.lines, '', ...chunks[0].lines];
  }

  const sections = chunks.map((c, i) => {
    const h1 = c.lines.find(l => /^#\s/.test(l));
    const title = c.title || (h1 ? h1.replace(/^#\s+/, '') : i === 0 ? 'Overview' : `${fallbackTitle} ${i + 1}`);
    const s = buildSection(title, c.lines.join('\n'), i + 1);
    s.content = normalizeMarkdown(c.lines.join('\n'), { allowH1: i === 0 });
    s.content = ensureSectionHeading(s.content, s.title);
    return s;
  });

  return sections.length ? sections : [buildSection(fallbackTitle || 'Overview', text, 1)];
}

/**
 * Normalizes JSON-shaped sections returned by a model (legacy / fallback path).
 */
export function normalizeJsonSections(rawSections: any[], fallbackTitle: string): DocSection[] {
  if (!Array.isArray(rawSections)) return [];
  return rawSections
    .filter(r => r && typeof r === 'object')
    .map((r, i) => {
      const content = typeof r.content === 'string' ? r.content : typeof r.markdown === 'string' ? r.markdown : '';
      return buildSection(typeof r.title === 'string' ? r.title : `${fallbackTitle} ${i + 1}`, content, i + 1);
    })
    .filter(s => s.content.trim().length > 0);
}

/* ------------------------------------------------------------------ */
/* Markdown linter (used by the local audit + post-AI validation)      */
/* ------------------------------------------------------------------ */

export interface MarkdownLintIssue {
  severity: IssueSeverity;
  title: string;
  explanation: string;
  suggestedFix: string;
  snippet?: string;
}

const VALID_ALERTS = ['NOTE', 'TIP', 'IMPORTANT', 'WARNING', 'CAUTION'];

export function lintMarkdown(content: string): MarkdownLintIssue[] {
  const issues: MarkdownLintIssue[] = [];
  const lines = content.replace(/\r\n?/g, '\n').split('\n');

  let fenceMarker: string | null = null;
  let fenceStartLine = -1;
  let untypedBlocks = 0;
  let prevHeadingLevel = 0;
  const headingJumps: string[] = [];
  const placeholders: string[] = [];
  const badAlerts = new Set<string>();
  let malformedTable = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fm = line.match(FENCE_RE);
    if (fm) {
      if (fenceMarker === null) {
        fenceMarker = fm[1];
        fenceStartLine = i;
        if (!fm[2].trim()) untypedBlocks++;
        continue;
      } else if (fm[1][0] === fenceMarker[0] && !fm[2].trim()) {
        fenceMarker = null;
        continue;
      }
    }
    if (fenceMarker !== null) continue;

    const h = line.match(/^(#{1,6})\s+(.+)$/);
    if (h) {
      const level = h[1].length;
      if (prevHeadingLevel && level > prevHeadingLevel + 1) headingJumps.push(line.trim());
      prevHeadingLevel = level;
    }

    if (/\b(TODO|TBD|FIXME|lorem ipsum)\b/i.test(line) || /\[(?:insert|placeholder|your text)[^\]]*\]/i.test(line)) {
      placeholders.push(line.trim().slice(0, 120));
    }

    const alert = line.match(/^\s*>\s*\[!(\w+)\]/);
    if (alert && !VALID_ALERTS.includes(alert[1].toUpperCase())) badAlerts.add(alert[1]);

    if (/^\|.*\|\s*$/.test(line) && (i === 0 || !/^\|.*\|\s*$/.test(lines[i - 1]))) {
      const next = lines[i + 1] || '';
      if (!/^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(next.trim())) malformedTable = true;
    }
  }

  if (fenceMarker !== null) {
    issues.push({
      severity: 'critical',
      title: 'Unclosed code block',
      explanation: `A fenced code block opened on line ${fenceStartLine + 1} is never closed, so everything after it renders as code.`,
      suggestedFix: 'Add a closing ``` line after the end of the code sample.',
      snippet: lines[fenceStartLine]
    });
  }

  if (/^\s*["']?(id|slug|order|content)["']?\s*:/im.test(lines.slice(0, 5).join('\n'))) {
    issues.push({
      severity: 'critical',
      title: 'Leaked metadata in content',
      explanation: 'The section starts with raw metadata keys (id/slug/content), usually caused by an AI model mixing JSON keys into Markdown.',
      suggestedFix: 'Remove the metadata lines so the section starts with its "## Title" heading.'
    });
  }

  if (untypedBlocks > 0) {
    issues.push({
      severity: 'suggestion',
      title: 'Code block without language tag',
      explanation: `${untypedBlocks} code block(s) have no language identifier, which disables syntax highlighting and the Run Code button.`,
      suggestedFix: 'Add a language after the opening backticks, e.g. ```javascript, ```bash or ```json.'
    });
  }

  if (headingJumps.length) {
    issues.push({
      severity: 'suggestion',
      title: 'Skipped heading levels',
      explanation: 'Heading levels jump (e.g. ## directly to ####), which breaks the outline and accessibility.',
      suggestedFix: 'Use sequential heading levels (## → ### → ####).',
      snippet: headingJumps.slice(0, 3).join('\n')
    });
  }

  if (placeholders.length) {
    issues.push({
      severity: 'warning',
      title: 'Placeholder or unfinished text',
      explanation: 'The section contains TODO/TBD/lorem ipsum or bracketed placeholders that readers will see.',
      suggestedFix: 'Replace placeholders with real content or remove them.',
      snippet: placeholders.slice(0, 3).join('\n')
    });
  }

  if (badAlerts.size) {
    issues.push({
      severity: 'suggestion',
      title: 'Unsupported callout type',
      explanation: `Callout markers ${[...badAlerts].map(a => `[!${a}]`).join(', ')} are not rendered as alerts.`,
      suggestedFix: 'Use one of: [!NOTE], [!TIP], [!IMPORTANT], [!WARNING], [!CAUTION].'
    });
  }

  if (malformedTable) {
    issues.push({
      severity: 'warning',
      title: 'Malformed table',
      explanation: 'A table header row is not followed by a separator row (| --- |), so it renders as plain text.',
      suggestedFix: 'Add a separator row such as "| --- | --- |" right below the header row.'
    });
  }

  if (/\]\(\s*\)|\]\(#\)/.test(content)) {
    issues.push({
      severity: 'warning',
      title: 'Empty link target',
      explanation: 'One or more links point to an empty URL or "#".',
      suggestedFix: 'Point the link to a real URL or convert it to plain text.'
    });
  }

  if (/!\[\s*\]\(/.test(content)) {
    issues.push({
      severity: 'suggestion',
      title: 'Image without alt text',
      explanation: 'Images without alternative text are inaccessible to screen readers.',
      suggestedFix: 'Describe the image inside the brackets: ![Architecture diagram](url).'
    });
  }

  return issues;
}

/** Simple word counter that ignores code blocks. */
export function countWords(markdown: string): number {
  const withoutCode = markdown.replace(/```[\s\S]*?```/g, ' ');
  return withoutCode.split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w)).length;
}
