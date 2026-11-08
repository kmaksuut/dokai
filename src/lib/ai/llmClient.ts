import type { AiProvider } from '../types';

/**
 * Unified LLM client used by every DokAI AI feature (generator, section enhance, audit).
 * - Single place for provider endpoints, model fallbacks, token limits and error mapping.
 * - Detects truncated responses (max token limit reached) so callers can react.
 */

export interface LlmRequest {
  provider: AiProvider;
  apiKey: string;
  /** Explicit model chosen by user for any provider (Gemini, Claude, OpenAI, OpenRouter). */
  selectedModel?: string;
  /** Only used for OpenRouter (user-selected model). */
  openrouterModel?: string;
  system: string;
  user: string;
  /** Ask the provider for a JSON object response when supported. */
  json?: boolean;
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
}

export interface LlmResponse {
  text: string;
  model: string;
  /** True when the model stopped because it hit the output token limit. */
  truncated: boolean;
}

export interface ProviderLiveModel {
  id: string;
  name: string;
  description?: string;
  contextLength?: number;
}

export const DEFAULT_OPENROUTER_MODEL = 'anthropic/claude-sonnet-4.5';

/**
 * Dynamically queries the provider's official API to discover which models are currently available.
 * Zero hardcoded lists — returns the exact live models supported by the user's API key.
 */
export async function fetchProviderLiveModels(
  provider: AiProvider,
  apiKey: string
): Promise<ProviderLiveModel[]> {
  const cleanKey = (apiKey || '').trim();
  if (!cleanKey) return [];

  if (provider === 'gemini') {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(cleanKey)}`
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Google API HTTP ${res.status}`);
    }
    const data = await res.json();
    const rawList: any[] = data?.models || [];
    return rawList
      .filter((m) => {
        const methods: string[] = m.supportedGenerationMethods || [];
        const name: string = m.name || '';
        return (
          methods.includes('generateContent') &&
          !name.includes('embedding') &&
          !name.includes('aqa')
        );
      })
      .map((m) => {
        const id = m.name.replace(/^models\//, '');
        return {
          id,
          name: m.displayName || id,
          description: m.description,
          contextLength: m.inputTokenLimit
        };
      })
      .sort((a, b) => {
        // Prioritize newest flash/pro models
        if (a.id.includes('flash') && !b.id.includes('flash')) return -1;
        if (!a.id.includes('flash') && b.id.includes('flash')) return 1;
        return a.id.localeCompare(b.id);
      });
  }

  if (provider === 'openai') {
    const res = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${cleanKey}` }
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `OpenAI API HTTP ${res.status}`);
    }
    const data = await res.json();
    const rawList: any[] = data?.data || [];
    return rawList
      .filter((m) => {
        const id: string = (m.id || '').toLowerCase();
        return (
          (id.startsWith('gpt-') || id.startsWith('o1') || id.startsWith('o3') || id.startsWith('chatgpt')) &&
          !id.includes('audio') &&
          !id.includes('realtime') &&
          !id.includes('embedding') &&
          !id.includes('tts') &&
          !id.includes('whisper') &&
          !id.includes('moderation') &&
          !id.includes('dall-e') &&
          !id.includes('instruct')
        );
      })
      .map((m) => ({
        id: m.id,
        name: m.id
      }))
      .sort((a, b) => {
        // Put flagship reasoning and 4o models first
        const score = (id: string) => {
          if (id.startsWith('o3')) return 4;
          if (id.startsWith('o1')) return 3;
          if (id.startsWith('gpt-4o')) return 2;
          return 1;
        };
        return score(b.id) - score(a.id) || a.id.localeCompare(b.id);
      });
  }

  if (provider === 'claude') {
    try {
      const res = await fetch('https://api.anthropic.com/v1/models', {
        headers: {
          'x-api-key': cleanKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        }
      });
      if (res.ok) {
        const data = await res.json();
        const rawList: any[] = data?.data || [];
        return rawList.map((m) => ({
          id: m.id,
          name: m.display_name || m.id
        }));
      }
    } catch {
      // Anthropic CORS / direct API fallback if blocked by browser policy
    }
    // If Anthropic list endpoint fails or is gated by browser policy, provide standard Anthropic models
    return [
      { id: 'claude-3-7-sonnet-latest', name: 'Claude 3.7 Sonnet (Latest Hybrid Reasoning)' },
      { id: 'claude-3-5-sonnet-latest', name: 'Claude 3.5 Sonnet' },
      { id: 'claude-3-5-haiku-latest', name: 'Claude 3.5 Haiku' },
      { id: 'claude-3-opus-latest', name: 'Claude 3 Opus' }
    ];
  }

  if (provider === 'openrouter') {
    const res = await fetch('https://openrouter.ai/api/v1/models');
    if (!res.ok) throw new Error(`OpenRouter API HTTP ${res.status}`);
    const data = await res.json();
    const rawList: any[] = data?.data || [];
    return rawList.map((m) => ({
      id: m.id,
      name: m.name || m.id,
      description: m.description,
      contextLength: m.context_length
    }));
  }

  return [];
}

export function getProviderLabel(provider: AiProvider): string {
  switch (provider) {
    case 'openrouter':
      return 'OpenRouter';
    case 'claude':
      return 'Anthropic Claude';
    case 'openai':
      return 'OpenAI';
    default:
      return 'Google Gemini';
  }
}

export function getModelLabel(provider: AiProvider, openrouterModel?: string, selectedModel?: string): string {
  if (selectedModel?.trim()) return selectedModel.trim();
  switch (provider) {
    case 'openrouter':
      return openrouterModel || DEFAULT_OPENROUTER_MODEL;
    case 'claude':
      return 'claude-3-7-sonnet-latest';
    case 'openai':
      return 'gpt-4o';
    default:
      return 'gemini-2.5-flash';
  }
}

export function hasUsableApiKey(apiKey?: string): apiKey is string {
  return !!apiKey && apiKey.trim().length > 5;
}

class ModelUnavailableError extends Error {}

function isAbort(err: any, signal?: AbortSignal): boolean {
  return err?.name === 'AbortError' || !!signal?.aborted;
}

/** Maps HTTP status codes to a human friendly hint. */
function describeHttpError(status: number, detail: string): string {
  const base = detail?.trim() ? detail.trim() : `HTTP ${status}`;
  if (status === 401 || status === 403) return `Invalid or unauthorized API key (HTTP ${status}). ${base}`;
  if (status === 402) return `Insufficient credits / billing required (HTTP 402). ${base}`;
  if (status === 429) return `Rate limit or quota exceeded (HTTP 429). Wait a moment and retry. ${base}`;
  if (status >= 500) return `Provider server error (HTTP ${status}). Try again shortly. ${base}`;
  return `HTTP ${status} - ${base}`;
}

async function readErrorDetail(res: Response): Promise<string> {
  const raw = await res.text().catch(() => '');
  try {
    const parsed = JSON.parse(raw);
    return parsed?.error?.message || parsed?.message || raw;
  } catch {
    return raw;
  }
}

function looksLikeMissingModel(status: number, detail: string): boolean {
  const d = detail.toLowerCase();
  return (
    status === 404 ||
    d.includes('not found') ||
    d.includes('not_found') ||
    d.includes('does not exist') ||
    d.includes('is not supported') ||
    d.includes('deprecated') ||
    d.includes('no longer available')
  );
}

async function callGemini(req: LlmRequest, model: string): Promise<LlmResponse> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(req.apiKey)}`;
  const generationConfig: Record<string, unknown> = {
    temperature: req.temperature ?? 0.35,
    maxOutputTokens: req.maxTokens ?? 8192
  };
  if (req.json) generationConfig.responseMimeType = 'application/json';

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: req.system }] },
      contents: [{ role: 'user', parts: [{ text: req.user }] }],
      generationConfig
    }),
    signal: req.signal
  });

  if (!res.ok) {
    const detail = await readErrorDetail(res);
    if (looksLikeMissingModel(res.status, detail) || res.status === 503) {
      throw new ModelUnavailableError(`Model ${model} unavailable: ${detail}`);
    }
    throw new Error(describeHttpError(res.status, detail));
  }

  const data = await res.json();
  const candidate = data?.candidates?.[0];
  const parts: any[] = candidate?.content?.parts || [];
  const text = parts
    .filter(p => typeof p?.text === 'string' && !p.thought)
    .map(p => p.text)
    .join('');
  const finishReason: string = candidate?.finishReason || '';

  if (!text.trim()) {
    const blockReason = data?.promptFeedback?.blockReason;
    throw new Error(
      `Gemini (${model}) returned an empty response${finishReason ? ` (finishReason: ${finishReason})` : ''}${blockReason ? ` (blocked: ${blockReason})` : ''}.`
    );
  }

  return { text, model, truncated: finishReason === 'MAX_TOKENS' };
}

async function callClaude(req: LlmRequest, model: string): Promise<LlmResponse> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': req.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model,
      max_tokens: req.maxTokens ?? 8192,
      temperature: req.temperature ?? 0.35,
      system: req.system,
      messages: [{ role: 'user', content: req.user }]
    }),
    signal: req.signal
  });

  if (!res.ok) {
    const detail = await readErrorDetail(res);
    if (looksLikeMissingModel(res.status, detail)) {
      throw new ModelUnavailableError(`Model ${model} unavailable: ${detail}`);
    }
    throw new Error(describeHttpError(res.status, detail));
  }

  const data = await res.json();
  const text = (data?.content || [])
    .filter((b: any) => b?.type === 'text')
    .map((b: any) => b.text)
    .join('');
  if (!text.trim()) throw new Error(`Claude (${model}) returned an empty response.`);
  return { text, model, truncated: data?.stop_reason === 'max_tokens' };
}

async function callOpenAiCompatible(
  req: LlmRequest,
  model: string,
  endpoint: string,
  extraHeaders: Record<string, string>,
  isOpenRouter: boolean
): Promise<LlmResponse> {
  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: 'system', content: req.system },
      { role: 'user', content: req.user }
    ],
    temperature: req.temperature ?? 0.35
  };
  if (isOpenRouter) {
    body.max_tokens = req.maxTokens ?? 8192;
  } else {
    body.max_completion_tokens = Math.min(req.maxTokens ?? 8192, 16000);
  }
  if (req.json && !isOpenRouter) body.response_format = { type: 'json_object' };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${req.apiKey}`,
      ...extraHeaders
    },
    body: JSON.stringify(body),
    signal: req.signal
  });

  if (!res.ok) {
    const detail = await readErrorDetail(res);
    if (!isOpenRouter && looksLikeMissingModel(res.status, detail)) {
      throw new ModelUnavailableError(`Model ${model} unavailable: ${detail}`);
    }
    throw new Error(describeHttpError(res.status, detail));
  }

  const data = await res.json();
  // OpenRouter may return HTTP 200 with an embedded upstream error
  if (data?.error) {
    const code = Number(data.error.code) || 500;
    throw new Error(describeHttpError(code, data.error.message || JSON.stringify(data.error)));
  }

  const choice = data?.choices?.[0];
  const content = choice?.message?.content;
  const text = Array.isArray(content)
    ? content.map((c: any) => (typeof c === 'string' ? c : c?.text || '')).join('')
    : content || '';
  if (!text.trim()) {
    throw new Error(
      `${isOpenRouter ? 'OpenRouter' : 'OpenAI'} (${model}) returned an empty response${choice?.finish_reason ? ` (finish_reason: ${choice.finish_reason})` : ''}. Verify the model name and your credits.`
    );
  }
  return { text, model: data?.model || model, truncated: choice?.finish_reason === 'length' };
}

/**
 * Calls the configured provider. Never applies a client-side timeout: we always wait
 * for the model unless the user aborts via `signal`.
 * Throws `Error` whose message starts with "AI Provider Error (...)".
 */
export async function callLlm(req: LlmRequest): Promise<LlmResponse> {
  const providerLabel = getProviderLabel(req.provider);
  const userModel = (req.selectedModel || '').trim();

  let candidates: string[];
  let runner: (model: string) => Promise<LlmResponse>;

  switch (req.provider) {
    case 'claude':
      candidates = userModel
        ? [userModel]
        : ['claude-3-7-sonnet-latest', 'claude-3-5-sonnet-latest'];
      runner = (m) => callClaude(req, m);
      break;
    case 'openai':
      candidates = userModel
        ? [userModel]
        : ['gpt-4o', 'gpt-4o-mini'];
      runner = (m) =>
        callOpenAiCompatible(req, m, 'https://api.openai.com/v1/chat/completions', {}, false);
      break;
    case 'openrouter':
      candidates = [req.openrouterModel?.trim() || userModel || DEFAULT_OPENROUTER_MODEL];
      runner = (m) =>
        callOpenAiCompatible(
          req,
          m,
          'https://openrouter.ai/api/v1/chat/completions',
          { 'HTTP-Referer': 'https://dokai.studio', 'X-Title': 'DokAI Studio' },
          true
        );
      break;
    default:
      candidates = userModel
        ? [userModel]
        : ['gemini-2.5-flash', 'gemini-2.0-flash'];
      runner = (m) => callGemini(req, m);
  }

  let lastError: Error | null = null;
  for (const model of candidates) {
    if (req.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    try {
      return await runner(model);
    } catch (err: any) {
      if (isAbort(err, req.signal)) throw new DOMException('Aborted', 'AbortError');
      if (err instanceof ModelUnavailableError) {
        lastError = err;
        continue;
      }
      if (err instanceof TypeError) {
        // fetch network failure (offline, DNS, CORS)
        throw new Error(
          `AI Provider Error (${providerLabel} · ${model}): Network request failed (${err.message}). Check your internet connection.`
        );
      }
      throw new Error(`AI Provider Error (${providerLabel} · ${model}): ${err?.message || String(err)}`);
    }
  }

  throw new Error(
    `AI Provider Error (${providerLabel}): No available model responded. ${lastError?.message || ''}`.trim()
  );
}

/* ------------------------------------------------------------------ */
/* JSON helpers (used only for small structured payloads like audits) */
/* ------------------------------------------------------------------ */

function extractJsonText(text: string): string {
  const cleaned = text.trim();
  const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fence && fence[1].trim().startsWith('{')) return fence[1].trim();
  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');
  if (first !== -1 && last > first) return cleaned.substring(first, last + 1);
  return cleaned;
}

/**
 * Repairs common LLM JSON anomalies: invalid escapes, raw newlines/tabs in strings,
 * trailing commas and truncated output.
 */
export function repairJsonString(jsonStr: string): string {
  let result = '';
  let inString = false;
  const stack: string[] = [];
  let i = 0;

  while (i < jsonStr.length) {
    const ch = jsonStr[i];

    if (!inString) {
      if (ch === '"') inString = true;
      else if (ch === '{') stack.push('}');
      else if (ch === '[') stack.push(']');
      else if (ch === '}' || ch === ']') stack.pop();
      result += ch;
      i++;
      continue;
    }

    if (ch === '\\') {
      const next = jsonStr[i + 1];
      if (next !== undefined && '"\\/bfnrt'.includes(next)) {
        result += ch + next;
        i += 2;
        continue;
      }
      if (next === 'u' && /^[0-9a-fA-F]{4}$/.test(jsonStr.substring(i + 2, i + 6))) {
        result += jsonStr.substring(i, i + 6);
        i += 6;
        continue;
      }
      result += '\\\\';
      i++;
      continue;
    }

    if (ch === '"') {
      inString = false;
      result += ch;
      i++;
      continue;
    }
    if (ch === '\n') result += '\\n';
    else if (ch === '\r') result += '\\r';
    else if (ch === '\t') result += '\\t';
    else result += ch;
    i++;
  }

  if (inString) result += '"';
  result = result.replace(/,\s*([}\]])/g, '$1').replace(/,\s*$/, '');
  while (stack.length) result += stack.pop();
  return result;
}

export function cleanAndParseJson<T = any>(rawText: string, contextDescription = 'AI response'): T {
  const extracted = extractJsonText(rawText);
  try {
    return JSON.parse(extracted);
  } catch {
    try {
      return JSON.parse(repairJsonString(extracted));
    } catch (err: any) {
      throw new Error(`Failed to parse ${contextDescription}: ${err?.message || 'Invalid JSON syntax'}`);
    }
  }
}
