import { describe, expect, it } from 'vitest';
import { applyTheme, THEME_COLORS } from './theme';

const themeColorMetas = () => [...document.head.querySelectorAll('meta[name="theme-color"]')];

describe('applyTheme', () => {
  it('sets the theme attribute and tints the mobile browser chrome to match', () => {
    applyTheme('light');
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(themeColorMetas().map(m => m.getAttribute('content'))).toEqual([THEME_COLORS.light]);
  });

  it('retints on every change, through one meta rather than stacking them', () => {
    applyTheme('light');
    applyTheme('dark');
    applyTheme('light');
    applyTheme('dark');
    expect(themeColorMetas().map(m => m.getAttribute('content'))).toEqual([THEME_COLORS.dark]);
  });

  it('replaces the meta element instead of rewriting it — iOS Safari only reads it once', () => {
    applyTheme('light');
    const first = themeColorMetas()[0];
    applyTheme('dark');
    const second = themeColorMetas()[0];
    expect(second).not.toBe(first);
    expect(first.isConnected).toBe(false);
  });

  it('takes over a meta that first paint left in the head, without duplicating it', () => {
    themeColorMetas().forEach(meta => meta.remove());
    const preexisting = document.createElement('meta');
    preexisting.name = 'theme-color';
    preexisting.content = '#000000';
    document.head.appendChild(preexisting);

    applyTheme('dark');
    expect(themeColorMetas().map(m => m.getAttribute('content'))).toEqual([THEME_COLORS.dark]);
  });
});
