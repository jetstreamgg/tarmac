import { describe, expect, it } from 'vitest';
import { parseUnits } from 'viem';
import { calculateAmountUsd } from './helpers';

describe('calculateAmountUsd', () => {
  it('calculates the USD value of an 18-decimal token amount', () => {
    expect(calculateAmountUsd(parseUnits('100', 18), '2', 18)).toBe(200);
  });

  it('calculates the USD value of a 6-decimal token amount (USDC)', () => {
    expect(calculateAmountUsd(parseUnits('100', 6), '1', 6)).toBe(100);
  });

  it('handles fractional prices for 6-decimal tokens', () => {
    expect(calculateAmountUsd(parseUnits('50', 6), '0.9998', 6)).toBeCloseTo(49.99, 2);
  });

  it('returns 0 for a zero amount', () => {
    expect(calculateAmountUsd(0n, '1.5', 6)).toBe(0);
  });
});
