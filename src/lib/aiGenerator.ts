import type {
  Documentation,
  DocSection,
  DocTemplateType,
  AiProvider,
  AiEnhanceMode,
  AiSectionEnhanceParams,
  AiDocAnalysisParams,
  DocAnalysisReport,
  DocAnalysisIssue,
  IssueSeverity
} from './types';
import {
  callLlm,
  cleanAndParseJson,
  getModelLabel,
  getProviderLabel,
  hasUsableApiKey
} from './ai/llmClient';
import {
  buildMarkdownStyleGuide,
  cleanSectionTitle,
  countWords,
  DEPTH_SPEC,
  DOC_FORMAT_SPEC,
  ensureSectionHeading,
  lintMarkdown,
  normalizeJsonSections,
  normalizeMarkdown,
  parseDelimitedDocument,
  parseSectionsFromMarkdown,
  slugify,
  type DocDepth,
  type OutputLanguage
} from './ai/markdownProtocol';

export { cleanAndParseJson, parseSectionsFromMarkdown };
export type { OutputLanguage, DocDepth };

export interface AiGenerationParams {
  title: string;
  topic: string;
  templateType: DocTemplateType;
  author?: string;
  description?: string;
  sourceCode?: string;
  apiKey?: string;
  provider?: AiProvider;
  selectedModel?: string;
  openrouterModel?: string;
  language?: OutputLanguage;
  depth?: DocDepth;
  onProgress?: (step: string, percentage: number) => void;
}

export interface AiEnhanceParams {
  doc: Documentation;
  mode: AiEnhanceMode;
  customInstructions?: string;
  apiKey?: string;
  provider?: AiProvider;
  selectedModel?: string;
  openrouterModel?: string;
  onProgress?: (step: string, percentage: number) => void;
}

/**
 * Sanitizes and normalizes section Markdown, stripping leaked metadata (`id:`, `title:`,
 * `slug:`, `content:`, YAML front-matter) while preserving headings, code blocks, tables,
 * and GitHub callout alerts.
 */
export function sanitizeSectionMarkdown(rawContent: string, sectionTitle?: string): string {
  const cleaned = normalizeMarkdown(rawContent);
  if (cleaned.trim().length < 5) {
    const t = sectionTitle || 'Section';
    return `## ${t}\n\nThis section covers **${t}** with technical specifications and practical examples.\n\n> [!NOTE]\n> Add implementation details or use **Enhance Section** to expand this section.`;
  }
  return sectionTitle ? ensureSectionHeading(cleaned, cleanSectionTitle(sectionTitle, 'Section')) : cleaned;
}

/**
 * Normalizes an array of raw sections from any AI model or fallback text.
 */
export function normalizeAndSanitizeSections(
  rawSections: any[],
  fallbackTitle: string,
  rawTextFallback?: string
): DocSection[] {
  const fromJson = normalizeJsonSections(rawSections, fallbackTitle);
  if (fromJson.length > 0) return fromJson;
  if (rawTextFallback && rawTextFallback.trim().length > 20) {
    const delimited = parseDelimitedDocument(rawTextFallback);
    if (delimited && delimited.sections.length > 0) return delimited.sections;
    return parseSectionsFromMarkdown(rawTextFallback, fallbackTitle);
  }
  return [];
}

function startProgressTicker(
  onProgress: ((step: string, percentage: number) => void) | undefined,
  steps: Array<{ pct: number; msg: string }>
): () => void {
  let currentIdx = 0;
  if (steps.length > 0) {
    onProgress?.(steps[0].msg, steps[0].pct);
  }
  const interval = setInterval(() => {
    currentIdx++;
    if (currentIdx < steps.length) {
      onProgress?.(steps[currentIdx].msg, steps[currentIdx].pct);
    }
  }, 2400);
  return () => clearInterval(interval);
}

function getTemplateOutline(type: DocTemplateType): string {
  switch (type) {
    case 'api':
      return 'Suggested section progression: Overview & Base URLs, Authentication & Security, Core Endpoints (requests, parameters, responses), Error Codes & Rate Limits, SDK / Client Examples (TypeScript, Python, cURL), Webhooks & Best Practices.';
    case 'guide':
      return 'Suggested section progression: Introduction & Prerequisites, Installation & Setup, Quickstart Walkthrough, Core Concepts & Configuration, Common Workflows & Recipes, Troubleshooting & FAQ.';
    case 'architecture':
      return 'Suggested section progression: Executive Overview & Goals, System Architecture & Component Matrix, Data Flow & Execution Lifecycle, Storage & Schema Design, Scalability, Reliability & Security, Deployment & Observability.';
    case 'sdk':
      return 'Suggested section progression: Overview & Installation, Initialization & Configuration, Core Classes & Methods Reference, Async Patterns & Error Handling, Practical End-to-End Examples, Migration & Versioning.';
    case 'code_to_doc':
      return 'Suggested section progression: Module Overview & Purpose, Architecture & Control Flow, Public API Signatures & Types Table, Key Algorithms & Edge Cases, Runnable Usage Examples, Testing & Maintenance Notes.';
    default:
      return 'Organize into logical, progressive technical sections starting from Overview and Setup through Core Concepts, Examples, and Operational Best Practices.';
  }
}

export async function generateDocumentationWithAi(
  params: AiGenerationParams,
  externalSignal?: AbortSignal
): Promise<Documentation> {
  const {
    title,
    topic,
    templateType,
    description = '',
    sourceCode = '',
    apiKey,
    provider = 'gemini',
    selectedModel,
    openrouterModel,
    language = 'auto',
    depth = 'standard',
    onProgress
  } = params;

  onProgress?.('Initializing DokAI generator engine...', 15);
  await new Promise(r => setTimeout(r, 250));

  if (hasUsableApiKey(apiKey)) {
    const providerLabel = getProviderLabel(provider);
    const modelLabel = getModelLabel(provider, openrouterModel, selectedModel);

    const stopTicker = startProgressTicker(onProgress, [
      { pct: 30, msg: `Connecting to ${providerLabel} (${modelLabel})...` },
      { pct: 45, msg: `Sending technical specification & Markdown style rules...` },
      { pct: 60, msg: `AI model is authoring multi-section documentation...` },
      { pct: 75, msg: `Synthesizing runnable code blocks, GFM tables & callouts...` },
      { pct: 88, msg: `Validating Markdown hierarchy and section formatting...` }
    ]);

    try {
      const depthSpec = DEPTH_SPEC[depth] || DEPTH_SPEC.standard;
      const system = `You are a Principal Technical Writer and Staff Software Architect authoring production-grade engineering documentation for DokAI Studio.

${buildMarkdownStyleGuide(language)}

${DOC_FORMAT_SPEC}`;

      const user = `Create a complete, multi-section technical documentation set with the following specification:
- Document Title: "${title || topic}"
- Primary Topic / Technologies: "${topic || title}"
- Template Archetype: "${templateType}" (${getCategoryName(templateType)})
- Target Depth: ${depthSpec.sections} sections, approximately ${depthSpec.words} words per section
- Additional Context / Audience: "${description || 'Software engineers and technical practitioners'}"
${sourceCode.trim() ? `- Reference Source Code / Schema:\n\`\`\`\n${sourceCode.trim()}\n\`\`\`` : ''}

${getTemplateOutline(templateType)}

Remember: Follow the <<<DOC_META>>> / <<<SECTION: Title>>> / <<<END>>> delimiter format strictly. Inside every section, output pure, well-structured GitHub-Flavored Markdown starting with "## <Section Title>".`;

      const res = await callLlm({
        provider,
        apiKey: apiKey.trim(),
        selectedModel: params.selectedModel,
        openrouterModel,
        system,
        user,
        maxTokens: 8192,
        temperature: 0.35,
        signal: externalSignal
      });

      stopTicker();
      onProgress?.('Normalizing Markdown sections & verifying syntax...', 95);

      let parsedDoc = parseDelimitedDocument(res.text);
      let sections: DocSection[] = parsedDoc?.sections || [];

      if (sections.length === 0) {
        try {
          const asJson = cleanAndParseJson(res.text, 'AI documentation response');
          if (asJson && Array.isArray(asJson.sections)) {
            sections = normalizeJsonSections(asJson.sections, title || topic);
            parsedDoc = {
              title: asJson.title,
              description: asJson.description,
              tags: Array.isArray(asJson.tags) ? asJson.tags : undefined,
              sections
            };
          }
        } catch {
          sections = parseSectionsFromMarkdown(res.text, title || topic);
        }
      }

      if (sections.length === 0) {
        sections = parseSectionsFromMarkdown(res.text, title || topic);
      }

      const docId = 'doc-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
      const now = new Date().toISOString();

      onProgress?.('Documentation generated successfully!', 100);
      return {
        id: docId,
        title: parsedDoc?.title || title.trim() || topic.trim() || 'AI Documentation',
        description:
          parsedDoc?.description ||
          description.trim() ||
          `Comprehensive ${getCategoryName(templateType)} documentation for ${topic || title}.`,
        version: '1.0.0',
        category: getCategoryName(templateType),
        author: 'AI Created',
        tags:
          parsedDoc?.tags && parsedDoc.tags.length > 0
            ? parsedDoc.tags
            : [
                (topic || title).toLowerCase().replace(/\s+/g, '-'),
                templateType,
                'dokai-ai'
              ],
        createdAt: now,
        updatedAt: now,
        sections
      };
    } catch (err: any) {
      stopTicker();
      if (err?.name === 'AbortError' || externalSignal?.aborted) {
        throw new Error('Generation cancelled by user.');
      }
      const rawMsg = err?.message || String(err);
      if (rawMsg.startsWith('AI Provider Error')) {
        throw err;
      }
      throw new Error(`AI Provider Error (${providerLabel}): ${rawMsg}`);
    }
  }

  // Offline template synthesis fallback when no API key is configured
  onProgress?.('No API Key configured: Running DokAI Local Template Engine...', 35);
  await new Promise(r => setTimeout(r, 300));

  onProgress?.('Synthesizing section hierarchy and TOC...', 65);
  await new Promise(r => setTimeout(r, 350));

  onProgress?.('Writing Markdown specifications and code samples...', 85);
  await new Promise(r => setTimeout(r, 300));

  const sections = generateInternalSections(title, topic, templateType, description, sourceCode);
  const docId = 'doc-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
  const now = new Date().toISOString();

  onProgress?.('Documentation generated successfully!', 100);
  return {
    id: docId,
    title: title.trim() || 'New Documentation',
    description: description.trim() || `Generated for ${topic} by DokAI Assistant.`,
    version: '1.0.0',
    category: getCategoryName(templateType),
    author: 'AI Created',
    tags: [topic.toLowerCase().replace(/\s+/g, '-'), templateType, 'dokai-ai'],
    createdAt: now,
    updatedAt: now,
    sections
  };
}

function getCategoryName(type: DocTemplateType): string {
  switch (type) {
    case 'api':
      return 'REST API';
    case 'guide':
      return 'User Guide';
    case 'architecture':
      return 'Architecture';
    case 'sdk':
      return 'SDK & Library';
    case 'code_to_doc':
      return 'Code Reference';
    default:
      return 'General Docs';
  }
}

function generateInternalSections(
  title: string,
  topic: string,
  type: DocTemplateType,
  description: string,
  sourceCode: string
): DocSection[] {
  const safeTitle = title || 'Documentation';
  const safeTopic = topic || 'System';

  if (type === 'api') {
    return [
      {
        id: 'sec-overview',
        title: 'Overview & Authentication',
        slug: 'overview-and-auth',
        order: 1,
        content: `## Overview & Authentication

${description || `Modern and scalable RESTful API services providing programmatic control over ${safeTopic}.`}

### Authentication

Every HTTP request must include a verified Bearer token inside the \`Authorization\` header:

\`\`\`http
Authorization: Bearer <YOUR_API_TOKEN>
Content-Type: application/json
Accept: application/json
\`\`\`

> [!NOTE]
> Sandbox base URL: \`https://sandbox.api.example.com/v1\` | Production base URL: \`https://api.example.com/v1\`

### HTTP Status Code Reference

| Code | Status | Description |
| :--- | :--- | :--- |
| **200** | \`OK\` | The request was processed and returned expected payload. |
| **201** | \`Created\` | The resource was successfully created. |
| **400** | \`Bad Request\` | The payload or query parameters are invalid. |
| **401** | \`Unauthorized\` | Bearer token is missing, expired, or rejected. |
| **403** | \`Forbidden\` | Insufficient permissions to access this resource. |
| **500** | \`Internal Error\` | Server encountered an unexpected exception. |`
      },
      {
        id: 'sec-endpoints',
        title: 'Endpoints & CRUD Operations',
        slug: 'endpoints-crud',
        order: 2,
        content: `## Endpoints & CRUD Operations

### \`GET /items\`

Returns a paginated collection of ${safeTopic} records.

#### Query Parameters

- \`page\` *(number, optional)*: Page offset index (Default: 1)
- \`limit\` *(number, optional)*: Max records per request (Max: 100, Default: 20)
- \`sort\` *(string, optional)*: Sorting key (e.g. \`created_at:desc\`)

\`\`\`bash
curl -X GET "https://api.example.com/v1/items?limit=10&page=1" \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Accept: application/json"
\`\`\`

#### Example JSON Response

\`\`\`json
{
  "success": true,
  "data": [
    {
      "id": "item_90214",
      "title": "${safeTopic} Instance #1",
      "status": "active",
      "created_at": "2026-10-30T22:00:00Z"
    }
  ],
  "meta": {
    "total": 48,
    "page": 1,
    "per_page": 10
  }
}
\`\`\`

### \`POST /items\`

Creates a new ${safeTopic} instance.

\`\`\`json
{
  "name": "New ${safeTopic} Instance",
  "enabled": true,
  "metadata": {
    "region": "us-east-1"
  }
}
\`\`\``
      },
      {
        id: 'sec-sdk-examples',
        title: 'Client Integration (TS & Python)',
        slug: 'client-integration',
        order: 3,
        content: `## Client Integration (TS & Python)

Easily connect to the ${safeTitle} API across environments:

### TypeScript / Modern Fetch

\`\`\`typescript
interface ItemResponse {
  success: boolean;
  data: Array<{ id: string; title: string }>;
}

export async function fetchItems(token: string): Promise<ItemResponse> {
  const response = await fetch("https://api.example.com/v1/items", {
    method: "GET",
    headers: {
      "Authorization": \`Bearer \${token}\`,
      "Content-Type": "application/json"
    }
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(\`API Exception (\${response.status}): \${errorBody}\`);
  }

  return await response.json();
}
\`\`\`

### Python (Requests)

\`\`\`python
import requests

def get_items(api_key: str):
    url = "https://api.example.com/v1/items"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Accept": "application/json"
    }
    response = requests.get(url, headers=headers, timeout=10)
    response.raise_for_status()
    return response.json()

if __name__ == "__main__":
    result = get_items("my-secret-key")
    print(f"Total count: {result.get('meta', {}).get('total')}")
\`\`\``
      }
    ];
  }

  if (type === 'code_to_doc' && sourceCode.trim().length > 0) {
    return [
      {
        id: 'sec-code-analysis',
        title: 'Code Analysis & Intent',
        slug: 'code-analysis',
        order: 1,
        content: `## Code Analysis & Intent

This technical breakdown examines the structure, parameters, and design patterns of **${safeTitle}**.

### Reference Implementation

\`\`\`typescript
${sourceCode.trim()}
\`\`\`

> [!TIP]
> Keep dependencies isolated and ensure all error paths return structured diagnostics.`
      },
      {
        id: 'sec-code-signature',
        title: 'Signatures & Type Specifications',
        slug: 'signatures-and-types',
        order: 2,
        content: `## Signatures & Type Specifications

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| **\`input\`** | \`Record<string, unknown>\` | Yes | Target entity payload |
| **\`options\`** | \`RequestOptions\` | No | Configuration overrides |
| **\`timeout\`** | \`number\` | No | Timeout deadline in milliseconds |

### Return Value

Returns a resolved \`Promise\` with normalized entity data or throws a typed error.`
      },
      {
        id: 'sec-code-usage',
        title: 'Usage & Verification',
        slug: 'usage-and-tests',
        order: 3,
        content: `## Usage & Verification

\`\`\`javascript
async function runDemo() {
  const payload = { target: "${safeTopic}", active: true };
  console.log("Executing operation with payload:", JSON.stringify(payload));
}

runDemo();
\`\`\``
      }
    ];
  }

  return [
    {
      id: 'sec-intro',
      title: 'Introduction & Objectives',
      slug: 'intro-and-objectives',
      order: 1,
      content: `## Introduction & Objectives

${description || `Comprehensive architectural reference and engineering guide for **${safeTopic}**.`}

### Scope & Audience

- **Target Audience:** Software Engineers, System Architects, DevOps
- **Release Version:** \`1.0.0\`
- **Supported Targets:** Cloud Native, Linux, Windows, macOS

> [!NOTE]
> Use the **Enhance Section** button in the bottom status bar to expand any section with AI directives.`
    },
    {
      id: 'sec-quickstart',
      title: 'Setup & Quickstart',
      slug: 'setup-and-quickstart',
      order: 2,
      content: `## Setup & Quickstart

Get your local environment running in three steps:

### 1. Install Dependencies

\`\`\`bash
npm install ${safeTopic.toLowerCase().replace(/\s+/g, '-')}
# Or using Bun:
bun add ${safeTopic.toLowerCase().replace(/\s+/g, '-')}
\`\`\`

### 2. Configure Environment (\`.env\`)

\`\`\`ini
NODE_ENV=development
APP_PORT=3000
LOG_LEVEL=info
\`\`\`

### 3. Verify Installation

\`\`\`javascript
console.log("${safeTitle} initialized successfully!");
\`\`\``
    },
    {
      id: 'sec-architecture',
      title: 'System Architecture & Flow',
      slug: 'architecture-and-flow',
      order: 3,
      content: `## System Architecture & Flow

Built on modular, event-driven design principles.

\`\`\`mermaid
flowchart LR
  Client["Client App"] --> Gateway["API Gateway"]
  Gateway --> Auth["Auth Service"]
  Gateway --> Core["Core Engine"]
  Core --> DB[("Primary Database")]
\`\`\`

### Logical Layers

1. **Client Gateway:** Request validation, authentication, and rate limiting.
2. **Core Engine:** Domain logic, state transitions, and background jobs.
3. **Persistence Layer:** Primary relational store and low-latency cache.`
    },
    {
      id: 'sec-faq',
      title: 'Troubleshooting & Best Practices',
      slug: 'troubleshooting-faq',
      order: 4,
      content: `## Troubleshooting & Best Practices

### Common Operational Checks

| Symptom | Likely Cause | Resolution |
| :--- | :--- | :--- |
| Connection timeout | Firewall or wrong port | Verify \`APP_PORT\` and network rules |
| \`401 Unauthorized\` | Expired or missing token | Rotate API credentials and check headers |
| High latency | Unindexed query path | Inspect slow query logs and add composite index |`
    }
  ];
}

function getEnhancementGoalDescription(mode: AiEnhanceMode, customInstructions?: string): string {
  switch (mode) {
    case 'comprehensive':
      return 'Thoroughly deepen, clarify, and expand every section. Fill missing theoretical, architectural, and practical explanations.';
    case 'code':
      return 'Add complete, runnable code examples, CLI commands, realistic configurations, and expected outputs to every section.';
    case 'security':
      return 'Harden documentation with production security guidelines, input validation patterns, vulnerability mitigations, and GitHub callout alerts (> [!IMPORTANT], > [!WARNING]).';
    case 'architecture':
      return 'Enrich with architectural breakdowns, component responsibility tables, ASCII topology flows, and execution lifecycle explanations.';
    case 'custom':
      return customInstructions?.trim() || 'Enhance the technical depth, clarity, and structure of the documentation.';
  }
}

export async function enhanceDocumentationWithAi(
  params: AiEnhanceParams,
  externalSignal?: AbortSignal
): Promise<DocSection[]> {
  const { doc, mode, customInstructions, apiKey, provider = 'gemini', selectedModel, openrouterModel, onProgress } = params;

  onProgress?.('Analyzing active document structure & sections...', 20);
  await new Promise(r => setTimeout(r, 250));

  const goalDescription = getEnhancementGoalDescription(mode, customInstructions);

  if (hasUsableApiKey(apiKey)) {
    const providerLabel = getProviderLabel(provider);
    const modelLabel = getModelLabel(provider, openrouterModel, selectedModel);

    const stopTicker = startProgressTicker(onProgress, [
      { pct: 35, msg: `Connecting to ${providerLabel} (${modelLabel})...` },
      { pct: 52, msg: `Sending document sections & enhancement directive...` },
      { pct: 70, msg: `AI model is enriching explanations, code & tables...` },
      { pct: 86, msg: `Formatting and validating enhanced Markdown...` }
    ]);

    try {
      const existingSectionsText = doc.sections
        .map(s => `<<<SECTION: ${s.title}>>>\n${s.content}`)
        .join('\n\n');

      const system = `You are a Principal Software Architect and Technical Writer enhancing an existing documentation set in DokAI Studio.

${buildMarkdownStyleGuide('auto')}

${DOC_FORMAT_SPEC}`;

      const user = `Enhance the following documentation for "${doc.title}" (${doc.category}).

Enhancement Directive:
${goalDescription}

Current Sections:
${existingSectionsText}

Preserve all existing sections (in the same order) and significantly improve each section's Markdown content according to the directive. Output using the <<<DOC_META>>> / <<<SECTION: Title>>> / <<<END>>> format.`;

      const res = await callLlm({
        provider,
        apiKey: apiKey.trim(),
        selectedModel: params.selectedModel,
        openrouterModel,
        system,
        user,
        maxTokens: 8192,
        temperature: 0.35,
        signal: externalSignal
      });

      stopTicker();
      onProgress?.('Verifying enhanced section structure...', 95);

      const delimited = parseDelimitedDocument(res.text);
      let enhancedSections = delimited?.sections || [];

      if (enhancedSections.length === 0) {
        try {
          const parsed = cleanAndParseJson(res.text, 'AI enhance response');
          if (parsed && Array.isArray(parsed.sections)) {
            enhancedSections = normalizeJsonSections(parsed.sections, doc.title);
          }
        } catch {
          enhancedSections = parseSectionsFromMarkdown(res.text, doc.title);
        }
      }

      if (enhancedSections.length === 0) {
        throw new Error('The AI model did not return any valid enhanced sections.');
      }

      // Preserve existing section IDs where possible so active tab selection stays intact
      enhancedSections = enhancedSections.map((sec, idx) => {
        const matchByTitle = doc.sections.find(
          orig => cleanSectionTitle(orig.title, '').toLowerCase() === cleanSectionTitle(sec.title, '').toLowerCase()
        );
        const fallbackOrig = doc.sections[idx];
        const preservedId = matchByTitle?.id || fallbackOrig?.id || sec.id;
        return {
          ...sec,
          id: preservedId,
          order: idx + 1
        };
      });

      onProgress?.('Documentation enhanced successfully!', 100);
      return enhancedSections;
    } catch (err: any) {
      stopTicker();
      if (err?.name === 'AbortError' || externalSignal?.aborted) {
        throw new Error('Enhancement cancelled by user.');
      }
      const rawMsg = err?.message || String(err);
      if (rawMsg.startsWith('AI Provider Error')) throw err;
      throw new Error(`AI Provider Error (${providerLabel}): ${rawMsg}`);
    }
  }

  onProgress?.('No API Key configured: Running DokAI Local Enhancement Engine...', 45);
  await new Promise(r => setTimeout(r, 350));
  onProgress?.('Enriching code samples, architecture tables and callouts...', 80);
  await new Promise(r => setTimeout(r, 350));

  const enhanced = generateLocalEnhancement(doc, mode);
  onProgress?.('Documentation enhanced successfully!', 100);
  return enhanced;
}

function generateLocalEnhancement(doc: Documentation, mode: AiEnhanceMode): DocSection[] {
  return doc.sections.map((sec, index) => {
    let extraContent = '';
    if (mode === 'code') {
      extraContent = `\n\n### Practical Implementation Example\n\n\`\`\`javascript\n// Verification example for ${sec.title}\nasync function verifySectionStep() {\n  const startTime = Date.now();\n  console.log("Running check for: ${sec.title.replace(/"/g, '\\"')}");\n  console.log("Completed in", Date.now() - startTime, "ms");\n}\n\nverifySectionStep();\n\`\`\``;
    } else if (mode === 'security') {
      extraContent = `\n\n> [!WARNING]\n> **Security Checklist:** Validate all external inputs, enforce least-privilege access controls, and never log raw credentials or session tokens.\n\n| Control | Requirement | Priority |\n| :--- | :--- | :--- |\n| **Authentication** | Short-lived signed tokens with rotation | Critical |\n| **Input Validation** | Strict schema validation at boundary | High |\n| **Audit Logging** | Structured immutable event trail | High |`;
    } else if (mode === 'architecture') {
      extraContent = `\n\n### Component & Execution Flow\n\n\`\`\`text\n[Client Request] ──▶ [Validation Layer] ──▶ [${sec.title}] ──▶ [Structured Response]\n\`\`\`\n\n| Stage | Responsibility | Failure Policy |\n| :--- | :--- | :--- |\n| **Ingress** | Schema & auth verification | Fast-fail 400/401 |\n| **Core Processing** | Execute domain logic | Idempotent retry |\n| **Egress** | Serialize & emit telemetry | Structured log |`;
    } else {
      extraContent = `\n\n> [!TIP]\n> **Key Takeaway (Section ${index + 1}):** Keep modules cohesive, document edge cases explicitly, and verify behavior with automated tests.`;
    }
    return {
      ...sec,
      content: sec.content.includes(extraContent.trim())
        ? sec.content
        : sanitizeSectionMarkdown(sec.content + extraContent, sec.title)
    };
  });
}

/**
 * Enhances strictly a single active section according to the user's specific directive.
 * Leaves all other sections and documents completely untouched.
 */
export async function enhanceSectionWithAi(
  params: AiSectionEnhanceParams,
  externalSignal?: AbortSignal
): Promise<DocSection> {
  const { docTitle, section, instruction, apiKey, provider = 'gemini', selectedModel, openrouterModel, onProgress } = params;

  onProgress?.(`Analyzing active section "${section.title}"...`, 20);
  await new Promise(r => setTimeout(r, 200));

  if (hasUsableApiKey(apiKey)) {
    const providerLabel = getProviderLabel(provider);
    const modelLabel = getModelLabel(provider, openrouterModel, selectedModel);

    const stopTicker = startProgressTicker(onProgress, [
      { pct: 40, msg: `Executing directive via ${providerLabel} (${modelLabel})...` },
      { pct: 65, msg: `Rewriting & enriching section "${section.title}"...` },
      { pct: 85, msg: `Validating Markdown formatting, code blocks & callouts...` }
    ]);

    const cleanTitle = cleanSectionTitle(section.title, 'Section');

    const system = `You are a Principal Software Engineer and Technical Writer revising a single documentation section inside DokAI Studio.

${buildMarkdownStyleGuide('auto')}

CRITICAL SECTION RULES:
- Modify ONLY the provided section "${cleanTitle}".
- Output ONLY the complete, updated GitHub-Flavored Markdown for this section.
- Start the response directly with "## ${cleanTitle}".
- NEVER output JSON, YAML front-matter, or metadata keys like "id:", "title:", "slug:", "content:".
- Preserve existing accurate technical details unless the user directive asks to replace or correct them.`;

    const user = `Document Context: "${docTitle}"
Target Section Title: "${cleanTitle}"

Current Section Markdown:
${section.content}

User Directive / Instructions:
${instruction}

Apply the user directive thoroughly and output the complete revised Markdown for this section now:`;

    try {
      const res = await callLlm({
        provider,
        apiKey: apiKey.trim(),
        selectedModel: params.selectedModel,
        openrouterModel,
        system,
        user,
        maxTokens: 6144,
        temperature: 0.35,
        signal: externalSignal
      });

      stopTicker();
      onProgress?.('Applying sanitized Markdown to section...', 95);

      const finalContent = sanitizeSectionMarkdown(res.text, cleanTitle);

      onProgress?.('Section enhanced successfully!', 100);
      return {
        ...section,
        id: section.id,
        title: section.title,
        slug: section.slug,
        content: finalContent
      };
    } catch (err: any) {
      stopTicker();
      if (err?.name === 'AbortError' || externalSignal?.aborted) {
        throw new Error('Section enhancement was cancelled.');
      }
      const rawMsg = err?.message || String(err);
      if (rawMsg.startsWith('AI Provider Error')) throw err;
      throw new Error(`AI Provider Error (${providerLabel}): ${rawMsg}`);
    }
  }

  // Local Offline Intelligence Engine Enhancement
  onProgress?.('Applying directive via DokAI Local Engine...', 60);
  await new Promise(r => setTimeout(r, 350));
  const cleanDirective = instruction.trim();

  let directiveSnippet = '';
  const lowerDir = cleanDirective.toLowerCase();
  if (lowerDir.includes('security') || lowerDir.includes('guard') || lowerDir.includes('auth')) {
    directiveSnippet = `\n\n### Security & Production Guidelines\n\n> [!IMPORTANT]\n> **Security Verification:** Never expose unencrypted tokens, secrets, or internal stack traces in production responses.\n\n- **Rate Limiting:** Enforce strict per-client token bucket limits.\n- **Input Validation:** Validate and sanitize untrusted payloads at the API boundary.\n- **Audit Logging:** Record security-sensitive events with correlation IDs.`;
  } else if (lowerDir.includes('table') || lowerDir.includes('compare') || lowerDir.includes('schema')) {
    directiveSnippet = `\n\n### Technical Comparison & Specifications\n\n| Aspect | Baseline Approach | Recommended Pattern | Impact |\n| :--- | :--- | :--- | :--- |\n| **Concurrency** | Blocking synchronous calls | Non-blocking async I/O & bounded queues | Prevents thread starvation |\n| **Error Handling** | Unchecked exceptions | Explicit typed results & structured retries | Predictable failure recovery |\n| **Observability** | Unstructured console text | Structured JSON logs & trace spans | Faster root-cause analysis |`;
  } else if (lowerDir.includes('architecture') || lowerDir.includes('flow')) {
    directiveSnippet = `\n\n### Architecture & Execution Flow\n\n\`\`\`text\n[Client] ──(1. Request)──▶ [Service: ${section.title}] ──(2. Validate & Query)──▶ [Store]\n[Client] ◀──(4. 200 OK)─── [Service: ${section.title}] ◀──(3. Result Payload)──── [Store]\n\`\`\``;
  } else {
    directiveSnippet = `\n\n### Practical Example: ${cleanDirective}\n\n> [!TIP]\n> **Applied Directive:** ${cleanDirective}\n\n\`\`\`javascript\n// Runnable example for: ${cleanDirective.replace(/\n/g, ' ')}\nasync function runExample() {\n  const config = { section: "${section.title.replace(/"/g, '\\"')}", status: "ready" };\n  console.log("Executing:", JSON.stringify(config));\n}\n\nrunExample();\n\`\`\``;
  }

  const enhancedContent = sanitizeSectionMarkdown(`${section.content}\n${directiveSnippet}`, section.title);
  onProgress?.('Section enhanced successfully!', 100);
  return {
    ...section,
    id: section.id,
    content: enhancedContent
  };
}

/**
 * Audits the active document for factual inaccuracies, code bugs, structural Markdown issues,
 * and missing prerequisites. Combines deterministic Markdown linting with deep AI analysis.
 */
export async function analyzeDocumentWithAi(
  params: AiDocAnalysisParams,
  externalSignal?: AbortSignal
): Promise<DocAnalysisReport> {
  const { doc, apiKey, provider = 'gemini', selectedModel, openrouterModel, onProgress } = params;

  onProgress?.(`Starting technical & Markdown audit for "${doc.title}"...`, 15);
  await new Promise(r => setTimeout(r, 250));

  const localReport = generateLocalAudit(doc);

  if (hasUsableApiKey(apiKey)) {
    const providerLabel = getProviderLabel(provider);
    const modelLabel = getModelLabel(provider, openrouterModel, selectedModel);

    const stopTicker = startProgressTicker(onProgress, [
      { pct: 35, msg: `Connecting to ${providerLabel} (${modelLabel})...` },
      { pct: 55, msg: `Auditing factual accuracy, code samples & edge cases...` },
      { pct: 78, msg: `Compiling prioritized issue report & suggested fixes...` }
    ]);

    const docContentDump = doc.sections
      .map((s, idx) => `Section #${idx + 1} [id="${s.id}" title="${s.title}"]:\n${s.content}\n---`)
      .join('\n\n');

    const system = `You are a Principal Software Architect, Senior Code Reviewer, and Technical Documentation Auditor.
Audit the provided documentation for factual inaccuracies, broken or non-runnable code samples, security flaws, outdated APIs, and structural clarity issues.
Return strictly a valid JSON object matching the schema.`;

    const user = `Audit this technical document:
Title: "${doc.title}"
Category: "${doc.category}"
Description: "${doc.description}"

Sections:
${docContentDump}

Audit Categories:
- "critical": Broken code, syntax/compile errors, security vulnerabilities, leaked metadata.
- "inaccuracy": Factual, conceptual, or API mistakes in explanations or parameters.
- "warning": Outdated patterns, missing error handling, edge-case pitfalls, malformed tables.
- "suggestion": Missing examples, diagrams, prerequisites, or clarity improvements.

Return ONLY a valid JSON object with this exact structure:
{
  "summary": "2-3 sentence executive summary of document quality and main findings.",
  "healthScore": 85,
  "issues": [
    {
      "id": "issue-1",
      "sectionId": "exact section id from above",
      "sectionTitle": "exact section title from above",
      "severity": "critical",
      "title": "Concise issue title",
      "explanation": "Why this is wrong, risky, or incomplete.",
      "suggestedFix": "Concrete replacement Markdown or corrected code snippet."
    }
  ]
}`;

    try {
      const res = await callLlm({
        provider,
        apiKey: apiKey.trim(),
        selectedModel: params.selectedModel,
        openrouterModel,
        system,
        user,
        json: true,
        maxTokens: 4096,
        temperature: 0.2,
        signal: externalSignal
      });

      stopTicker();
      onProgress?.('Structuring analysis findings & issue report...', 90);

      const parsed = cleanAndParseJson(res.text, 'AI document audit report');

      const aiIssues: DocAnalysisIssue[] = Array.isArray(parsed?.issues)
        ? parsed.issues.map((iss: any, idx: number) => {
            const matchedSection =
              doc.sections.find(s => s.id === iss.sectionId) ||
              doc.sections.find(
                s =>
                  s.title.toLowerCase().trim() === String(iss.sectionTitle || '').toLowerCase().trim() ||
                  cleanSectionTitle(s.title, '').toLowerCase() ===
                    cleanSectionTitle(String(iss.sectionTitle || ''), '').toLowerCase()
              );
            const sev: IssueSeverity = ['critical', 'inaccuracy', 'warning', 'suggestion'].includes(iss.severity)
              ? iss.severity
              : 'warning';
            return {
              id: iss.id || `ai-issue-${idx + 1}`,
              sectionId: matchedSection?.id || iss.sectionId,
              sectionTitle: matchedSection?.title || iss.sectionTitle || 'General',
              severity: sev,
              title: iss.title || 'Identified Technical Issue',
              explanation: iss.explanation || 'No explanation provided.',
              suggestedFix: iss.suggestedFix || 'Review and update this section.'
            };
          })
        : [];

      // Merge critical/warning deterministic lint issues that weren't already reported
      const mergedIssues: DocAnalysisIssue[] = [...aiIssues];
      for (const localIss of localReport.issues) {
        if (localIss.severity === 'critical' || localIss.severity === 'warning') {
          const duplicate = mergedIssues.some(
            m =>
              m.sectionTitle === localIss.sectionTitle &&
              m.title.toLowerCase().includes(localIss.title.toLowerCase().slice(0, 12))
          );
          if (!duplicate) mergedIssues.push(localIss);
        }
      }

      onProgress?.('Analysis report ready!', 100);
      return {
        docId: doc.id,
        docTitle: doc.title,
        summary: parsed?.summary || localReport.summary,
        healthScore:
          typeof parsed?.healthScore === 'number'
            ? Math.min(100, Math.max(0, Math.round(parsed.healthScore)))
            : localReport.healthScore,
        totalIssues: mergedIssues.length,
        issues: mergedIssues,
        analyzedAt: new Date().toISOString()
      };
    } catch (err: any) {
      stopTicker();
      if (err?.name === 'AbortError' || externalSignal?.aborted) {
        throw new Error('Document audit was cancelled.');
      }
      const rawMsg = err?.message || String(err);
      if (rawMsg.startsWith('AI Provider Error')) throw err;
      throw new Error(`AI Provider Error (${providerLabel}): ${rawMsg}`);
    }
  }

  onProgress?.('Running DokAI Structural & Markdown Rule Auditor...', 65);
  await new Promise(r => setTimeout(r, 350));
  onProgress?.('Analysis report ready!', 100);
  return localReport;
}

function generateLocalAudit(doc: Documentation): DocAnalysisReport {
  const issues: DocAnalysisIssue[] = [];
  let score = 96;

  doc.sections.forEach((sec, idx) => {
    const words = countWords(sec.content);
    if (words < 35) {
      score -= 7;
      issues.push({
        id: `local-thin-${idx}`,
        sectionId: sec.id,
        sectionTitle: sec.title,
        severity: 'warning',
        title: 'Shallow or Incomplete Section',
        explanation: `This section contains only ${words} words of prose, which leaves core concepts under-explained.`,
        suggestedFix: `Expand "${sec.title}" with concrete architectural context, prerequisites, and a working code example.`
      });
    }

    const lintFindings = lintMarkdown(sec.content);
    lintFindings.forEach((finding, fIdx) => {
      const penalty =
        finding.severity === 'critical' ? 12 : finding.severity === 'warning' ? 5 : 2;
      score -= penalty;
      issues.push({
        id: `local-lint-${idx}-${fIdx}`,
        sectionId: sec.id,
        sectionTitle: sec.title,
        severity: finding.severity,
        title: finding.title,
        explanation: finding.explanation,
        suggestedFix: finding.suggestedFix,
        snippet: finding.snippet
      });
    });

    if (
      !/^>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/m.test(sec.content) &&
      words > 80
    ) {
      score -= 2;
      issues.push({
        id: `local-callout-${idx}`,
        sectionId: sec.id,
        sectionTitle: sec.title,
        severity: 'suggestion',
        title: 'No Highlighted Callout Box',
        explanation:
          'Long technical sections benefit from a GitHub callout (`> [!NOTE]`, `> [!TIP]`, or `> [!WARNING]`) to highlight key caveats.',
        suggestedFix: `> [!TIP]\n> Summarize the most important operational takeaway for **${sec.title}** here.`
      });
    }
  });

  const clampedScore = Math.max(35, Math.min(100, score));
  return {
    docId: doc.id,
    docTitle: doc.title,
    summary:
      issues.length === 0
        ? 'All sections pass structural Markdown, code block, and completeness checks!'
        : `Audit inspected ${doc.sections.length} section(s) and found ${issues.length} actionable improvement(s).`,
    healthScore: clampedScore,
    totalIssues: issues.length,
    issues,
    analyzedAt: new Date().toISOString()
  };
}
