import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  usePageScrollbarGutter,
  PAGE_SCROLLBAR_GUTTER_VAR,
  PAGE_SCROLLBAR_ATTR
} from './usePageScrollbarGutter';

const setWidths = (inner: number, body: number) => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: inner });
  Object.defineProperty(document.body, 'clientWidth', { configurable: true, value: body });
};
const gutter = () => document.documentElement.style.getPropertyValue(PAGE_SCROLLBAR_GUTTER_VAR);
const kind = () => document.documentElement.getAttribute(PAGE_SCROLLBAR_ATTR);
const flush = () => new Promise(resolve => setTimeout(resolve, 0));

// jsdom has no ResizeObserver; the stub records the callback so a test can
// fire it the way a body box change would.
let resizeCallbacks: Array<() => void> = [];
class ResizeObserverStub {
  constructor(cb: () => void) {
    resizeCallbacks.push(cb);
  }
  observe() {}
  disconnect() {}
}

describe('usePageScrollbarGutter', () => {
  beforeEach(() => {
    setWidths(1440, 1429);
    resizeCallbacks = [];
    vi.stubGlobal('ResizeObserver', ResizeObserverStub);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.removeAttribute('data-scroll-locked');
    document.documentElement.style.removeProperty(PAGE_SCROLLBAR_GUTTER_VAR);
    document.documentElement.removeAttribute(PAGE_SCROLLBAR_ATTR);
  });

  it('publishes innerWidth minus body width — the reserved column, bar or not', () => {
    renderHook(() => usePageScrollbarGutter());
    expect(gutter()).toBe('11px');
    expect(kind()).toBe('classic');
  });

  it('flags overlay bars, where nothing is reserved', () => {
    setWidths(1440, 1440);
    renderHook(() => usePageScrollbarGutter());
    expect(gutter()).toBe('0px');
    expect(kind()).toBe('overlay');
  });

  it('re-measures on a window resize', () => {
    renderHook(() => usePageScrollbarGutter());
    setWidths(1440, 1440);
    window.dispatchEvent(new Event('resize'));
    expect(gutter()).toBe('0px');
  });

  // macOS swaps overlay bars for classic ones when a mouse is plugged in, with
  // no window resize: only body's box changes.
  it("re-measures when body's box changes without a resize event", () => {
    setWidths(1440, 1440);
    renderHook(() => usePageScrollbarGutter());
    expect(gutter()).toBe('0px');
    setWidths(1440, 1429);
    resizeCallbacks.forEach(cb => cb());
    expect(gutter()).toBe('11px');
    expect(kind()).toBe('classic');
  });

  // Under a lock body carries the column as a margin, so a reading would be
  // the margin, not the column: the value from before the lock stands, and
  // the release re-reads it in case the bar changed meanwhile.
  it('does not read while a scroll lock is up, and re-reads on release', async () => {
    renderHook(() => usePageScrollbarGutter());
    document.body.setAttribute('data-scroll-locked', '1');
    setWidths(1440, 1418);
    window.dispatchEvent(new Event('resize'));
    expect(gutter()).toBe('11px');
    setWidths(1440, 1440);
    document.body.removeAttribute('data-scroll-locked');
    await flush();
    expect(gutter()).toBe('0px');
    expect(kind()).toBe('overlay');
  });

  it('leaves the value in place on unmount', () => {
    const { unmount } = renderHook(() => usePageScrollbarGutter());
    unmount();
    expect(gutter()).toBe('11px');
  });

  it('never goes negative', () => {
    setWidths(1400, 1440);
    renderHook(() => usePageScrollbarGutter());
    expect(gutter()).toBe('0px');
  });
});
