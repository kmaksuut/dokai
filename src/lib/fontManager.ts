/**
 * Global Font Manager for DokAI
 * Supports:
 * 1. Curated popular system and UI fonts
 * 2. Local system font discovery via Local Font Access API (window.queryLocalFonts)
 * 3. Custom font file upload (.ttf, .otf, .woff, .woff2) with Base64 persistence
 * 4. Dynamic CSS variable injection (--app-font) for entire application
 */

export interface FontPreset {
  id: string;
  name: string;
  family: string;
  category: 'sans' | 'mono' | 'serif' | 'display';
}

export const PRESET_FONTS: FontPreset[] = [
  { id: 'inter', name: 'Inter (Default DokAI)', family: "'Inter', -apple-system, sans-serif", category: 'sans' },
  { id: 'segoe', name: 'Segoe UI (Windows Fluent)', family: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif", category: 'sans' },
  { id: 'jetbrains', name: 'JetBrains Mono (Developer)', family: "'JetBrains Mono', Consolas, monospace", category: 'mono' },
  { id: 'fira-code', name: 'Fira Code (Developer)', family: "'Fira Code', Consolas, monospace", category: 'mono' },
  { id: 'cascadia', name: 'Cascadia Code / Mono', family: "'Cascadia Code', 'Cascadia Mono', Consolas, monospace", category: 'mono' },
  { id: 'consolas', name: 'Consolas (Windows Classic)', family: "Consolas, 'Courier New', monospace", category: 'mono' },
  { id: 'roboto', name: 'Roboto', family: "'Roboto', -apple-system, sans-serif", category: 'sans' },
  { id: 'open-sans', name: 'Open Sans', family: "'Open Sans', sans-serif", category: 'sans' },
  { id: 'outfit', name: 'Outfit (Modern Display)', family: "'Outfit', -apple-system, sans-serif", category: 'display' },
  { id: 'georgia', name: 'Georgia (Editorial Serif)', family: "Georgia, 'Times New Roman', serif", category: 'serif' },
  { id: 'system-ui', name: 'System Default (OS Native)', family: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif", category: 'sans' }
];

let activeCustomFontFace: FontFace | null = null;

/**
 * Checks if the browser/environment supports the Local Font Access API
 */
export function isLocalFontAccessSupported(): boolean {
  return typeof window !== 'undefined' && 'queryLocalFonts' in window && typeof (window as any).queryLocalFonts === 'function';
}

/**
 * Queries installed fonts from the user's operating system (Windows/macOS/Linux)
 */
export async function scanLocalSystemFonts(): Promise<string[]> {
  if (!isLocalFontAccessSupported()) {
    return [];
  }
  try {
    const fonts = await (window as any).queryLocalFonts();
    const familySet = new Set<string>();
    for (const font of fonts) {
      if (font && font.family) {
        familySet.add(font.family);
      }
    }
    return Array.from(familySet).sort((a, b) => a.localeCompare(b));
  } catch (err) {
    console.warn('Local Font Access query was denied or failed:', err);
    return [];
  }
}

/**
 * Converts a font file (.ttf, .otf, .woff, .woff2) into a Base64 data URL and registers it with the FontFace API
 */
export async function loadCustomFontFile(file: File): Promise<{ fontName: string; fontDataUrl: string }> {
  const rawName = file.name.replace(/\.[^/.]+$/, '').trim();
  const fontName = `DokAI_User_${rawName.replace(/\W+/g, '_')}`;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (event) => {
      const fontDataUrl = event.target?.result as string;
      try {
        await registerCustomFontData(fontName, fontDataUrl);
        resolve({ fontName, fontDataUrl });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read font file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Registers font data into document.fonts
 */
export async function registerCustomFontData(fontName: string, fontDataUrl: string): Promise<void> {
  if (typeof window === 'undefined' || !fontDataUrl) return;

  try {
    if (activeCustomFontFace) {
      document.fonts.delete(activeCustomFontFace);
      activeCustomFontFace = null;
    }

    const fontFace = new FontFace(fontName, `url(${fontDataUrl})`);
    const loaded = await fontFace.load();
    document.fonts.add(loaded);
    activeCustomFontFace = loaded;
  } catch (err) {
    console.warn('Failed to register custom FontFace:', err);
  }
}

/**
 * Applies the font family globally across the application by setting CSS variable --app-font
 */
export function applyAppFont(
  fontFamily: string = 'Inter',
  customFontData?: string,
  customFontName?: string
): void {
  if (typeof document === 'undefined') return;

  // If there's a custom uploaded font, ensure it is loaded first
  if (customFontData && customFontName && fontFamily.includes(customFontName)) {
    registerCustomFontData(customFontName, customFontData);
  }

  const clean = fontFamily.trim();
  let fontStack = clean;

  // Format quotes if family name contains spaces and lacks quotes
  if (clean.includes(' ') && !clean.startsWith('"') && !clean.startsWith("'") && !clean.includes(',')) {
    fontStack = `"${clean}", 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
  } else if (!clean.includes(',')) {
    fontStack = `${clean}, 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
  }

  document.documentElement.style.setProperty('--app-font', fontStack);
}
