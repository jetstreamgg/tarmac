import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePageScrollbarGutter, PAGE_SCROLLBAR_GUTTER_VAR } from './usePageScrollbarGutter';

const setWidths = (inner: number, body: number) => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: inner });
  Object.defineProperty(document.body, 'clientWidth', { configurable: true, value: body });
};

describe('usePageScrollbarGutter', () => {
  beforeEach(() => setWidths(1440, 1429));
  afterEach(() => {
    document.body.removeAttribute('data-scroll-locked');
    document.documentElement.style.removeProperty(PAGE_SCROLLBAR_GUTTER_VAR);
  });

  it('publishes innerWidth minus body width — the reserved column, bar or not', () => {
    const { unmount } = renderHook(() => usePageScrollbarGutter());
    expect(document.documentElement.style.getPropertyValue(PAGE_SCROLLBAR_GUTTER_VAR)).toBe('11px');
    unmount();
    expect(document.documentElement.style.getPropertyValue(PAGE_SCROLLBAR_GUTTER_VAR)).toBe('');
  });

  it('re-measures on resize', () => {
    renderHook(() => usePageScrollbarGutter());
    setWidths(1440, 1440);
    window.dispatchEvent(new Event('resize'));
    expect(document.documentElement.style.getPropertyValue(PAGE_SCROLLBAR_GUTTER_VAR)).toBe('0px');
  });

  // Under a lock body carries the column as a margin, so the reading would be
  // the margin, not the column; the value from before the lock stands.
  it('does not read while a scroll lock is up', () => {
    renderHook(() => usePageScrollbarGutter());
    document.body.setAttribute('data-scroll-locked', '1');
    setWidths(1440, 1418);
    window.dispatchEvent(new Event('resize'));
    expect(document.documentElement.style.getPropertyValue(PAGE_SCROLLBAR_GUTTER_VAR)).toBe('11px');
  });

  it('never goes negative', () => {
    setWidths(1400, 1440);
    renderHook(() => usePageScrollbarGutter());
    expect(document.documentElement.style.getPropertyValue(PAGE_SCROLLBAR_GUTTER_VAR)).toBe('0px');
    vi.restoreAllMocks();
  });
});
