import { Theme } from '@/modules/config/types/user-config';

/** Baseline when there's no saved choice and no OS hint (app shipped dark-only). */
export const DEFAULT_THEME: Theme = 'dark';

/**
 * Tint for the mobile browser chrome — Android Chrome's address bar and iOS
 * Safari *before* 26 (APP-518). Outside a standalone/PWA display mode the page
 * cannot extend under those strips, so they can be coloured but not covered.
 *
 * `<meta name="theme-color">` is not what fixes this on current iOS: **Safari
 * 26 ignores the tag outright** — verified on the 26.2 simulator, where a
 * literal `content="#ff0000"` changed nothing, declared in the markup or
 * injected before first paint alike. It derives the strips from the page
 * instead, and the colour it lands on is `body`'s. That is handled in
 * globals.css by `--color-browserChrome`, which these values mirror; the meta
 * stays for the browsers that do read it.
 *
 * The values are sampled off the top of the app's own background image, not
 * `--color-pageBackground` — that is the flat base the image is baked over and
 * reads a step darker/lighter than anything on screen. Do not reach for it
 * here: it also rings the IconStack badges, which must match the page.
 *
 * If a device shows the strip mismatching the page, nudge these, the CSS token
 * *and* the twin literals in index.html (which has to inline them to get the
 * tint right on the first paint) together.
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

  // For the browsers that still read it — Android Chrome, iOS before 26; on
  // iOS 26 the tint comes from `body`'s background instead, which the
  // `--color-browserChrome` rule in globals.css swaps off the attribute above.
  // Replaced rather than re-assigned: Safari reads a meta once and does not
  // watch the attribute, so rewriting `content` in place goes unnoticed.
  document.head.querySelectorAll('meta[name="theme-color"]').forEach(meta => meta.remove());
  const meta = document.createElement('meta');
  meta.name = 'theme-color';
  meta.content = THEME_COLORS[theme];
  document.head.appendChild(meta);
};
