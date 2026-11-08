import type { CustomThemePalette } from './types';

// Convert HSL to Hex color string
function hslToHex(h: number, s: number, l: number): string {
  l /= 100;
  const a = (s * Math.min(l, 1 - l)) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

// Generate an aesthetically pleasing randomized theme palette
export function generateRandomTheme(isDark: boolean = true): CustomThemePalette {
  const primaryHue = Math.floor(Math.random() * 360);
  const secondaryHue = (primaryHue + 40 + Math.floor(Math.random() * 40)) % 360;

  if (isDark) {
    const primary = hslToHex(primaryHue, 85, 65);
    const bgBase = hslToHex(primaryHue, 35, 6);
    const bgSurface = hslToHex(primaryHue, 25, 9);
    const titlebarBg = hslToHex(primaryHue, 30, 7);
    const toolbarBg = hslToHex(primaryHue, 28, 10);
    const sidebarBg = hslToHex(primaryHue, 26, 8);
    const editorBg = hslToHex(primaryHue, 22, 10);
    const previewBg = hslToHex(primaryHue, 24, 9);
    const borderColor = hslToHex(primaryHue, 25, 17);

    return {
      primary,
      primarySubtle: `hsla(${primaryHue}, 85%, 65%, 0.15)`,
      badgeBg: `hsla(${primaryHue}, 85%, 65%, 0.22)`,
      bgBase,
      bgSurface,
      titlebarBg,
      toolbarBg,
      sidebarBg,
      editorBg,
      previewBg,
      borderColor,
      textPrimary: '#f8fafc',
      textSecondary: hslToHex(primaryHue, 15, 68)
    };
  } else {
    const primary = hslToHex(primaryHue, 80, 45);
    const bgBase = hslToHex(primaryHue, 20, 97);
    const bgSurface = '#ffffff';
    const titlebarBg = hslToHex(primaryHue, 18, 93);
    const toolbarBg = hslToHex(primaryHue, 15, 95);
    const sidebarBg = hslToHex(primaryHue, 18, 96);
    const editorBg = '#ffffff';
    const previewBg = hslToHex(primaryHue, 16, 98);
    const borderColor = hslToHex(primaryHue, 20, 88);

    return {
      primary,
      primarySubtle: `hsla(${primaryHue}, 80%, 45%, 0.1)`,
      badgeBg: `hsla(${primaryHue}, 80%, 45%, 0.15)`,
      bgBase,
      bgSurface,
      titlebarBg,
      toolbarBg,
      sidebarBg,
      editorBg,
      previewBg,
      borderColor,
      textPrimary: '#0f172a',
      textSecondary: '#64748b'
    };
  }
}

// Apply theme palette directly to document root CSS variables
export function applyThemePalette(palette: CustomThemePalette | null, mode: 'dark' | 'light' | 'custom'): void {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  root.setAttribute('data-theme', mode === 'light' ? 'light' : 'dark');

  if (palette && mode === 'custom') {
    root.style.setProperty('--bg-base', palette.bgBase);
    root.style.setProperty('--bg-surface', palette.bgSurface);
    root.style.setProperty('--titlebar-bg', palette.titlebarBg);
    root.style.setProperty('--toolbar-bg', palette.toolbarBg);
    root.style.setProperty('--sidebar-bg', palette.sidebarBg);
    root.style.setProperty('--editor-bg', palette.editorBg);
    root.style.setProperty('--preview-bg', palette.previewBg);
    root.style.setProperty('--border-color', palette.borderColor);
    root.style.setProperty('--text-primary', palette.textPrimary);
    root.style.setProperty('--text-secondary', palette.textSecondary);
    root.style.setProperty('--accent-color', palette.primary);
    root.style.setProperty('--accent-subtle', palette.primarySubtle);
    root.style.setProperty('--badge-bg', palette.badgeBg);
    root.style.setProperty('--scrollbar-track', palette.bgBase);
    root.style.setProperty('--scrollbar-thumb', palette.borderColor);
    root.style.setProperty('--scrollbar-thumb-hover', palette.primary);
  } else {
    // Clear inline custom styles to let default dark/light CSS take over
    root.style.removeProperty('--bg-base');
    root.style.removeProperty('--bg-surface');
    root.style.removeProperty('--titlebar-bg');
    root.style.removeProperty('--toolbar-bg');
    root.style.removeProperty('--sidebar-bg');
    root.style.removeProperty('--editor-bg');
    root.style.removeProperty('--preview-bg');
    root.style.removeProperty('--border-color');
    root.style.removeProperty('--text-primary');
    root.style.removeProperty('--text-secondary');
    root.style.removeProperty('--accent-color');
    root.style.removeProperty('--accent-subtle');
    root.style.removeProperty('--badge-bg');
    root.style.removeProperty('--scrollbar-track');
    root.style.removeProperty('--scrollbar-thumb');
    root.style.removeProperty('--scrollbar-thumb-hover');
  }
}

