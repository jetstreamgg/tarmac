import { Theme } from '@/modules/config/types/user-config';

/** Baseline when there's no saved choice and no OS hint (app shipped dark-only). */
export const DEFAULT_THEME: Theme = 'dark';

/** Read the OS-level color-scheme preference, falling back to the default theme. */
export const getSystemTheme = (): Theme => {
  if (typeof window === 'undefined' || !window.matchMedia) return DEFAULT_THEME;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : DEFAULT_THEME;
};

/**
 * Page background per theme, mirroring `--color-pageBackground` in globals.css.
 * Drives `<meta name="theme-color">`, which is what tints the browser chrome
 * around the viewport (Safari's status bar and toolbar on iOS, the address bar
 * on Android Chrome). Kept in sync with the pre-paint script in index.html.
 */
export const THEME_COLORS: Record<Theme, string> = {
  dark: '#090420',
  light: '#ecf0ff'
};

/** Point `<meta name="theme-color">` at the theme's page background, creating it if absent. */
const applyThemeColorMeta = (theme: Theme): void => {
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.appendChild(meta);
  }
  meta.content = THEME_COLORS[theme];
};

/** Apply a theme to the document by setting the `data-theme` attribute on <html>. */
export const applyTheme = (theme: Theme): void => {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = theme;
  applyThemeColorMeta(theme);
};
