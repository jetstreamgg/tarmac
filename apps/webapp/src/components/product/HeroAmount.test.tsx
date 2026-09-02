import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { HeroAmount, fitFontSize } from './HeroAmount';

/**
 * happy-dom does no layout, so every element measures 0. Each test declares the
 * widths flexbox would have produced: `clientWidth` is the slot the row granted
 * the amount, `scrollWidth` is what the digits want at the full 44px.
 */
function stubWidths({ clientWidth, scrollWidth }: { clientWidth: number; scrollWidth: number }) {
  for (const [prop, value] of [
    ['clientWidth', clientWidth],
    ['scrollWidth', scrollWidth]
  ] as const) {
    Object.defineProperty(HTMLElement.prototype, prop, { configurable: true, get: () => value });
  }
}

describe('fitFontSize', () => {
  it('keeps the comps size when the amount already fits', () => {
    expect(fitFontSize({ neededPx: 180, availablePx: 224 })).toBe(44);
    expect(fitFontSize({ neededPx: 224, availablePx: 224 })).toBe(44);
  });

  it('scales down in proportion to the overflow', () => {
    // The APP-541 case: 10,610,108.00 at 44px in a 390px iPhone's USDS slot.
    expect(fitFontSize({ neededPx: 285, availablePx: 224 })).toBe(34);
  });

  it('never drops below the floor', () => {
    expect(fitFontSize({ neededPx: 1000, availablePx: 100 })).toBe(20);
  });

  it('keeps the comps size when the element is unmeasurable', () => {
    expect(fitFontSize({ neededPx: 0, availablePx: 0 })).toBe(44);
    expect(fitFontSize({ neededPx: 285, availablePx: 0 })).toBe(44);
  });
});

describe('HeroAmount', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      }
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    // @ts-expect-error -- restoring the prototype getters happy-dom defines.
    delete HTMLElement.prototype.clientWidth;
    // @ts-expect-error -- ditto.
    delete HTMLElement.prototype.scrollWidth;
  });

  it('renders the amount at the comps size when it fits', () => {
    stubWidths({ clientWidth: 224, scrollWidth: 180 });
    render(<HeroAmount amount="10,000.00" testId="hero-amount" />);
    const el = screen.getByTestId('hero-amount');
    expect(el.textContent).toBe('10,000.00');
    expect(el.style.fontSize).toBe('44px');
  });

  it('shrinks a long amount instead of eliding it', () => {
    stubWidths({ clientWidth: 224, scrollWidth: 285 });
    render(<HeroAmount amount="10,610,108.00" testId="hero-amount" />);
    const el = screen.getByTestId('hero-amount');
    expect(el.style.fontSize).toBe('34px');
    expect(el.textContent).toBe('10,610,108.00');
  });

  it('holds the comps size when the element cannot be measured', () => {
    render(<HeroAmount amount="10,610,108.00" testId="hero-amount" />);
    expect(screen.getByTestId('hero-amount').style.fontSize).toBe('44px');
  });

  it('refits on window resize, so a shrunk amount grows back when the viewport does', () => {
    const add = vi.spyOn(window, 'addEventListener');
    const remove = vi.spyOn(window, 'removeEventListener');
    stubWidths({ clientWidth: 224, scrollWidth: 285 });

    const { unmount } = render(<HeroAmount amount="10,610,108.00" testId="hero-amount" />);
    // A parent-only ResizeObserver never fires here: the parent is content-sized,
    // so it shrinks with the amount and stops tracking the widening viewport.
    expect(add.mock.calls.filter(([event]) => event === 'resize')).toHaveLength(1);

    unmount();
    expect(remove.mock.calls.filter(([event]) => event === 'resize')).toHaveLength(1);
    add.mockRestore();
    remove.mockRestore();
  });

  it('scales tracking with the font size rather than pinning it in px', () => {
    stubWidths({ clientWidth: 224, scrollWidth: 285 });
    render(<HeroAmount amount="10,610,108.00" testId="hero-amount" />);
    expect(screen.getByTestId('hero-amount').className).toContain('tracking-[-0.02em]');
  });
});
