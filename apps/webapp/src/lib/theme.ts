import { Theme } from '@/modules/config/types/user-config';

/**
 * Default theme when the user has expressed no preference and the OS gives no hint.
 * The app shipped dark-only historically, so dark stays the baseline.
 */
export const DEFAULT_THEME: Theme = 'dark';

/** Read the OS-level color-scheme preference, falling back to the default theme. */
export const getSystemTheme = (): Theme => {
  if (typeof window === 'undefined' || !window.matchMedia) return DEFAULT_THEME;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : DEFAULT_THEME;
};

/** Apply a theme to the document by setting the `data-theme` attribute on <html>. */
export const applyTheme = (theme: Theme): void => {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = theme;
};
