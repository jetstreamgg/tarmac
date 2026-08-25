import { describe, expect, it } from 'vitest';
import { applyTheme, THEME_COLORS } from './theme';

const themeColorMetas = () => [...document.head.querySelectorAll('meta[name="theme-color"]')];

describe('applyTheme', () => {
  it('sets the theme attribute and tints the mobile browser chrome to match', () => {
    applyTheme('light');
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(themeColorMetas().map(m => m.getAttribute('content'))).toEqual([THEME_COLORS.light]);
  });

  it('retints on every change, through the one meta rather than stacking them', () => {
    applyTheme('light');
    applyTheme('dark');
    applyTheme('light');
    applyTheme('dark');
    expect(themeColorMetas().map(m => m.getAttribute('content'))).toEqual([THEME_COLORS.dark]);
  });
});
