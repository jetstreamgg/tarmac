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
 * The values are sampled off the top of the app's own background layer —
 * neither `--color-pageBackground` (the flat base the sky images are baked
 * over, a good step darker/lighter than what anyone actually sees) nor the
 * page's literal top row, which sits under the header bar's veil and in dark
 * mode dragged the tint most of the way back to black. Measured on the
 * background alone, and near enough constant over the first 160px (dark
 * #100b27 → #100b28) and across phone widths.
 *
 * If a real device shows the strip mismatching the page, nudge these *and*
 * their twin literals in index.html (which has to inline them to get the tint
 * right on the first paint). Do not reach for `--color-pageBackground`: it
 * also rings the IconStack badges, which must match the page, not this.
 */
export const THEME_COLORS: Record<Theme, string> = {
  dark: '#100b27',
  light: '#dbdfff'
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
  //
  // Replaced rather than re-assigned. Writing `content` on the meta already in
  // the head leaves iOS Safari showing the *previous* theme's tint until the
  // next navigation or reload — it reads the value once and does not watch the
  // attribute. Dropping the element and inserting a fresh one is a head change
  // it does pick up.
  document.head.querySelectorAll('meta[name="theme-color"]').forEach(meta => meta.remove());
  const meta = document.createElement('meta');
  meta.name = 'theme-color';
  meta.content = THEME_COLORS[theme];
  document.head.appendChild(meta);
};
