/**
 * Drop-in JSON Localization (i18n) Engine for DokAI.
 *
 * Adding a new language is as simple as:
 * 1) Dropping a `<lang>.json` (e.g. `de.json`, `fr.json`, `es.json`) into `src/lib/i18n/locales/`
 *    — Vite's `import.meta.glob` automatically discovers and registers it at build/dev time!
 * 2) OR importing a `.json` language file at runtime via Settings -> Import Language (.json).
 */

import enLocale from './locales/en.json';

export interface LocaleMeta {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
}

export type LocaleDictionary = Record<string, any> & {
  _meta?: LocaleMeta;
};

const CUSTOM_LOCALES_STORAGE_KEY = 'dokai_custom_locales_v1';
const ACTIVE_LOCALE_STORAGE_KEY = 'dokai_active_locale_v1';

// Automatically discover all *.json files in ./locales/
const builtInModules = import.meta.glob('./locales/*.json', { eager: true }) as Record<
  string,
  { default?: LocaleDictionary } | LocaleDictionary
>;

const initialLocales: Record<string, LocaleDictionary> = {};

for (const [path, mod] of Object.entries(builtInModules)) {
  const data = (mod && 'default' in mod && mod.default ? mod.default : mod) as LocaleDictionary;
  const fileCode = path.split('/').pop()?.replace('.json', '') || 'en';
  const code = data?._meta?.code || fileCode;
  initialLocales[code] = {
    ...data,
    _meta: {
      code,
      name: data?._meta?.name || code.toUpperCase(),
      nativeName: data?._meta?.nativeName || data?._meta?.name || code.toUpperCase(),
      flag: data?._meta?.flag || '🌐'
    }
  };
}

let localesRegistry = $state<Record<string, LocaleDictionary>>({ ...initialLocales });
let currentLocaleCode = $state<string>('en');

export function initI18n(preferredCode?: string) {
  if (typeof window === 'undefined') return;
  try {
    const rawCustom = localStorage.getItem(CUSTOM_LOCALES_STORAGE_KEY);
    if (rawCustom) {
      const parsed = JSON.parse(rawCustom) as Record<string, LocaleDictionary>;
      if (parsed && typeof parsed === 'object') {
        localesRegistry = { ...initialLocales, ...parsed };
      }
    }
    const savedCode = preferredCode || localStorage.getItem(ACTIVE_LOCALE_STORAGE_KEY);
    if (savedCode && localesRegistry[savedCode]) {
      currentLocaleCode = savedCode;
    } else {
      currentLocaleCode = 'en';
    }
  } catch (err) {
    console.warn('i18n initialization warning:', err);
  }
}

export function getLocale(): string {
  return currentLocaleCode;
}

export function setLocale(code: string): void {
  if (!localesRegistry[code]) return;
  currentLocaleCode = code;
  if (typeof window !== 'undefined') {
    localStorage.setItem(ACTIVE_LOCALE_STORAGE_KEY, code);
  }
}

export function getAvailableLocales(): LocaleMeta[] {
  return Object.entries(localesRegistry).map(([code, dict]) => ({
    code,
    name: dict._meta?.name || code.toUpperCase(),
    nativeName: dict._meta?.nativeName || dict._meta?.name || code.toUpperCase(),
    flag: dict._meta?.flag || '🌐'
  }));
}

export function registerCustomLocale(rawJsonString: string, fallbackFileName: string = 'custom.json'): LocaleMeta {
  const parsed = JSON.parse(rawJsonString) as LocaleDictionary;
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid JSON structure for language file.');
  }

  const fileCode = fallbackFileName.replace(/\.json$/i, '').toLowerCase().replace(/[^a-z0-9_-]/g, '') || 'custom';
  const code = (parsed._meta?.code || fileCode).toLowerCase();
  const meta: LocaleMeta = {
    code,
    name: parsed._meta?.name || code.toUpperCase(),
    nativeName: parsed._meta?.nativeName || parsed._meta?.name || code.toUpperCase(),
    flag: parsed._meta?.flag || '🌐'
  };

  const normalized: LocaleDictionary = {
    ...parsed,
    _meta: meta
  };

  localesRegistry = {
    ...localesRegistry,
    [code]: normalized
  };

  if (typeof window !== 'undefined') {
    try {
      const rawCustom = localStorage.getItem(CUSTOM_LOCALES_STORAGE_KEY);
      const existingCustom = rawCustom ? JSON.parse(rawCustom) : {};
      existingCustom[code] = normalized;
      localStorage.setItem(CUSTOM_LOCALES_STORAGE_KEY, JSON.stringify(existingCustom));
    } catch (e) {
      console.warn('Failed to persist custom locale:', e);
    }
  }

  setLocale(code);
  return meta;
}

export function getTemplateLocaleJson(): string {
  return JSON.stringify(enLocale, null, 2);
}

/**
 * Resolves a dot-notated translation key (e.g. `editor.runCode`) from the active locale,
 * falling back to `en.json` or the provided fallback string if a key is missing.
 */
export function t(path: string, fallback?: string): string {
  const parts = path.split('.');
  const activeDict = localesRegistry[currentLocaleCode] || enLocale;

  let cur: any = activeDict;
  for (const p of parts) {
    if (cur && typeof cur === 'object' && p in cur) {
      cur = cur[p];
    } else {
      cur = undefined;
      break;
    }
  }

  if (typeof cur === 'string') return cur;

  // Fallback to English dictionary
  let enCur: any = enLocale;
  for (const p of parts) {
    if (enCur && typeof enCur === 'object' && p in enCur) {
      enCur = enCur[p];
    } else {
      enCur = undefined;
      break;
    }
  }

  if (typeof enCur === 'string') return enCur;
  return fallback ?? path;
}
