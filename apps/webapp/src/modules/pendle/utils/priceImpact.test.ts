import { describe, expect, it } from 'vitest';
import { formatPriceImpact } from './priceImpact';

describe('formatPriceImpact', () => {
  it('negates the API sign so an unfavorable quote displays positive', () => {
    // Pendle: negative = unfavorable. Displayed under the app-wide inverse
    // convention, where positive = a cost to the user.
    expect(formatPriceImpact(-0.0012)).toBe('0.120%');
  });

  it('displays a favorable quote as a gain, not a cost', () => {
    // The regression this guards: Math.abs rendered this as "0.020%", the same
    // string an equally-sized cost produces.
    expect(formatPriceImpact(0.0002)).toBe('-0.020%');
  });

  it('keeps three decimals so sub-basis-point impacts stay legible', () => {
    expect(formatPriceImpact(-0.00004)).toBe('0.004%');
  });

  it('renders zero without a negative sign', () => {
    expect(formatPriceImpact(0)).toBe('0.000%');
    expect(formatPriceImpact(-0)).toBe('0.000%');
    // Rounds to zero at three decimals — "-0.000%" would imply a gain.
    expect(formatPriceImpact(0.0000001)).toBe('0.000%');
  });

  it('returns undefined when the API omits the field or sends a non-number', () => {
    expect(formatPriceImpact(undefined)).toBeUndefined();
    expect(formatPriceImpact(NaN)).toBeUndefined();
    expect(formatPriceImpact(Infinity)).toBeUndefined();
  });
});
