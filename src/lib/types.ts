export interface DocSection {
  id: string;
  title: string;
  slug: string;
  content: string;
  order: number;
}

export interface Documentation {
  id: string;
  title: string;
  description: string;
  version: string;
  category: string;
  author?: string;
  icon?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  sections: DocSection[];
}

export interface TabItem {
  docId: string;
  title: string;
  activeSectionId: string;
  isDirty?: boolean;
}

export type ViewMode = 'split' | 'preview' | 'edit';

export type DocTemplateType = 
  | 'api' 
  | 'guide' 
  | 'architecture' 
  | 'sdk' 
  | 'code_to_doc' 
  | 'custom';

export type ThemeMode = 'dark' | 'light' | 'custom';

export interface CustomThemePalette {
  primary: string;
  primarySubtle: string;
  badgeBg: string;
  bgBase: string;
  bgSurface: string;
  titlebarBg: string;
  toolbarBg: string;
  sidebarBg: string;
  editorBg: string;
  previewBg: string;
  borderColor: string;
  textPrimary: string;
  textSecondary: string;
}

export type AiProvider = 'gemini' | 'claude' | 'openai' | 'openrouter';

export type AiEnhanceMode = 'comprehensive' | 'code' | 'security' | 'architecture' | 'custom';

export type IssueSeverity = 'critical' | 'inaccuracy' | 'warning' | 'suggestion';

export interface DocAnalysisIssue {
  id: string;
  sectionId?: string;
  sectionTitle?: string;
  severity: IssueSeverity;
  title: string;
  explanation: string;
  suggestedFix: string;
  snippet?: string;
}

export interface DocAnalysisReport {
  docId: string;
  docTitle: string;
  summary: string;
  healthScore: number; // 0 - 100
  totalIssues: number;
  issues: DocAnalysisIssue[];
  analyzedAt: string;
}

export interface AiSectionEnhanceParams {
  docTitle: string;
  section: DocSection;
  instruction: string;
  apiKey?: string;
  provider?: AiProvider;
  selectedModel?: string;
  openrouterModel?: string;
  onProgress?: (step: string, percentage: number) => void;
}

export interface AiDocAnalysisParams {
  doc: Documentation;
  apiKey?: string;
  provider?: AiProvider;
  selectedModel?: string;
  openrouterModel?: string;
  onProgress?: (step: string, percentage: number) => void;
}

export interface AppSettings {
  aiProvider: AiProvider;
  geminiApiKey: string;
  claudeApiKey: string;
  openaiApiKey: string;
  openrouterApiKey: string;
  geminiModel?: string;
  claudeModel?: string;
  openaiModel?: string;
  openrouterModel?: string;
  apiKey: string; // fallback / legacy
  themeMode: ThemeMode;
  sidebarWidth: number;
  uiLanguage?: string;
  customPalette?: CustomThemePalette;
  appFontFamily?: string;
  customFontName?: string;
  customFontData?: string;
}
