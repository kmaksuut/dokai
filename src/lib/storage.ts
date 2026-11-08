import type { Documentation, TabItem, AppSettings, ThemeMode } from './types';
import { initialDocs } from './defaultDocs';

const STORAGE_KEYS = {
  DOCS: 'dokai_documents_v2',
  TABS: 'dokai_open_tabs_v2',
  ACTIVE_TAB: 'dokai_active_tab_id_v2',
  SETTINGS: 'dokai_settings_v2'
};

const DEFAULT_SETTINGS: AppSettings = {
  aiProvider: 'gemini',
  geminiApiKey: '',
  claudeApiKey: '',
  openaiApiKey: '',
  openrouterApiKey: '',
  geminiModel: 'gemini-2.5-flash',
  claudeModel: 'claude-3-5-sonnet-latest',
  openaiModel: 'gpt-4o',
  openrouterModel: 'anthropic/claude-3.5-sonnet',
  apiKey: '',
  themeMode: 'dark',
  sidebarWidth: 280,
  appFontFamily: 'Inter',
  uiLanguage: 'en'
};

export function loadDocs(): Documentation[] {
  if (typeof window === 'undefined') return initialDocs;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.DOCS);
    if (!raw) {
      saveDocs(initialDocs);
      return initialDocs;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      let updated = false;
      const merged: Documentation[] = [...parsed];

      for (const builtIn of initialDocs) {
        const existingIdx = merged.findIndex((d) => d.id === builtIn.id);
        if (existingIdx === -1) {
          if (builtIn.id === 'welcome-to-dokai') {
            merged.unshift(builtIn);
          } else {
            merged.push(builtIn);
          }
          updated = true;
        } else if (merged[existingIdx].version !== builtIn.version) {
          merged[existingIdx] = builtIn;
          updated = true;
        }
      }

      // Ensure welcome document is always positioned at index 0
      const welcomeIdx = merged.findIndex((d) => d.id === 'welcome-to-dokai');
      if (welcomeIdx > 0) {
        const [w] = merged.splice(welcomeIdx, 1);
        merged.unshift(w);
        updated = true;
      }

      if (updated) {
        saveDocs(merged);
      }
      return merged;
    }
    return initialDocs;
  } catch (err) {
    console.error('Failed to load documents:', err);
    return initialDocs;
  }
}

export function saveDocs(docs: Documentation[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEYS.DOCS, JSON.stringify(docs));
  } catch (err) {
    console.error('Failed to save documents:', err);
  }
}

export function loadTabs(availableDocs: Documentation[]): TabItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TABS);
    if (raw) {
      const parsed: TabItem[] = JSON.parse(raw);
      const valid = parsed.filter(t => availableDocs.some(d => d.id === t.docId));
      if (valid.length > 0) {
        if (!valid.some(t => t.docId === 'welcome-to-dokai') && availableDocs.some(d => d.id === 'welcome-to-dokai')) {
          const w = availableDocs.find(d => d.id === 'welcome-to-dokai')!;
          valid.unshift({
            docId: w.id,
            title: w.title,
            activeSectionId: w.sections[0]?.id || ''
          });
        }
        return valid;
      }
    }
  } catch (e) {
    console.warn('Failed to load tabs:', e);
  }

  return availableDocs.slice(0, 4).map(doc => ({
    docId: doc.id,
    title: doc.title,
    activeSectionId: doc.sections[0]?.id || ''
  }));
}

export function saveTabs(tabs: TabItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEYS.TABS, JSON.stringify(tabs));
  } catch (err) {
    console.error('Failed to save tabs:', err);
  }
}

export function loadActiveTabId(defaultId: string): string {
  if (typeof window === 'undefined') return defaultId;
  return localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB) || defaultId;
}

export function saveActiveTabId(docId: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB, docId);
}

export function loadSettings(): AppSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (raw) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    }
  } catch (e) {
    console.warn('Failed to load settings:', e);
  }
  return DEFAULT_SETTINGS;
}

export function saveSettings(settings: AppSettings): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  } catch (err) {
    console.error('Failed to save settings:', err);
  }
}
