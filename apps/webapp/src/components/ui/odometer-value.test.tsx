import { describe, expect, it, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { OdometerValue, parseFigure, tokenizeFigure } from './odometer-value';

const keys = (value: string) => tokenizeFigure(value).map(token => token.key);

describe('tokenizeFigure', () => {
  it('keys integer digits by place value and separators by the digits to their right', () => {
    expect(keys('$1,234.56')).toEqual(['p0', 'i3', 'is3', 'i2', 'i1', 'i0', 'd', 'f0', 'f1']);
  });

  it('keeps every existing column when the figure grows a digit', () => {
    const before = keys('$99,999.00');
    const after = keys('$100,000.00');
    for (const key of before) expect(after).toContain(key);
    // The separator has three digits to its right in both figures, so it is
    // the same column; only the new leading digit is new.
    expect(after.filter(key => !before.includes(key))).toEqual(['i5']);
    // A second separator appears at the million mark.
    expect(keys('$1,000,000.00').filter(key => !after.includes(key))).toEqual(['i6', 'is6']);
  });

  it('treats a three-digit tail as grouping, not a decimal point', () => {
    expect(keys('1,000')).toEqual(['i3', 'is3', 'i2', 'i1', 'i0']);
    expect(keys('1.234,56')).toEqual(['i3', 'is3', 'i2', 'i1', 'i0', 'd', 'f0', 'f1']);
  });

  it('keys prefix and suffix characters by index', () => {
    expect(keys('-$5 USD')).toEqual(['p0', 'p1', 'i0', 's0', 's1', 's2', 's3']);
  });

  it('parses the figure for its direction of travel', () => {
    expect(parseFigure('$1,234.56')).toBe(1234.56);
    expect(parseFigure('-$5')).toBe(-5);
    expect(parseFigure('1.234,56')).toBe(1234.56);
  });
});

describe('OdometerValue', () => {
  afterEach(cleanup);

  it('reads and copies as the plain figure, with the strips hidden from assistive tech', () => {
    render(<OdometerValue value="$1,234.56" />);
    const root = screen.getByTestId('odometer-value');
    expect(root.querySelector('.sr-only')?.textContent).toBe('$1,234.56');
    const strips = root.querySelectorAll('[data-testid=odometer-char]');
    expect(strips).toHaveLength('$1,234.56'.length);
  });

  it('keeps the same digit windows across a value change and only mounts new ones', () => {
    const { rerender } = render(<OdometerValue value="$99,999.00" />);
    const root = screen.getByTestId('odometer-value');
    const before = root.querySelectorAll('[data-testid=odometer-char]').length;
    rerender(<OdometerValue value="$100,000.00" />);
    expect(root.querySelector('.sr-only')?.textContent).toBe('$100,000.00');
    // One new character (the leading digit); exits are still animating out
    // under AnimatePresence, so the count only grows here.
    expect(root.querySelectorAll('[data-testid=odometer-char]').length).toBeGreaterThanOrEqual(before + 1);
  });
});
