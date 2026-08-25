import { Theme } from '@/modules/config/types/user-config';

/** Baseline when there's no saved choice and no OS hint (app shipped dark-only). */
export const DEFAULT_THEME: Theme = 'dark';

/**
 * Tint for the mobile browser chrome — iOS Safari's status bar and toolbar
 * strips, Android Chrome's address bar (APP-518). `<meta name="theme-color">`
 * is the only lever a page has over them: outside a standalone/PWA display
 * mode the page cannot extend *under* the status bar, so the strip can be
 * coloured but not covered. With no value at all Safari falls back to its own
 * default, which is the flat black the strips were showing.
 *
 * The values are sampled from the top row of the rendered page rather than
 * taken from `--color-pageBackground`: the real page top is the sky background
 * image over that base with the header's gradient on top, and in light mode
 * that reads a full step deeper than the token (#d2d2fa against #ecf0ff).
 * Measured stable across phone widths — 360, 393 and 430 all land within one
 * unit per channel.
 *
 * If a real device shows the strip mismatching the page, nudge these *and*
 * their twin literals in index.html (which has to inline them to get the tint
 * right on the first paint). Do not reach for `--color-pageBackground`: it
 * also rings the IconStack badges, which must match the page, not this.
 */
export const THEME_COLORS: Record<Theme, string> = {
  dark: '#0c0723',
  light: '#d2d2fa'
};

/** Read the OS-level color-scheme preference, falling back to the default theme. */
export const getSystemTheme = (): Theme => {
  if (typeof window === 'undefined' || !window.matchMedia) return DEFAULT_THEME;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : DEFAULT_THEME;
};

/** Apply a theme to the document by setting the `data-theme` attribute on <html>. */
export const applyTheme = (theme: Theme): void => {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = theme;

  // Kept in step with the theme rather than declared once in the markup: the
  // in-app toggle has to move the browser chrome with it.
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.appendChild(meta);
  }
  meta.content = THEME_COLORS[theme];
};
