import { describe, expect, it } from 'vitest';
import {
  applySlippageToMinOut,
  computeRealisedApy,
  formatPendleApy,
  isMarketMatured
} from './helpers';

describe('pendle helpers', () => {
  describe('isMarketMatured', () => {
    it('returns false when expiry is in the future', () => {
      expect(isMarketMatured(2_000_000_000, 1_500_000_000)).toBe(false);
    });

    it('returns true when expiry is in the past', () => {
      expect(isMarketMatured(1_400_000_000, 1_500_000_000)).toBe(true);
    });

    it('returns true at the exact expiry timestamp', () => {
      expect(isMarketMatured(1_500_000_000, 1_500_000_000)).toBe(true);
    });
  });

  describe('applySlippageToMinOut', () => {
    it('returns the same amount when slippage is 0', () => {
      expect(applySlippageToMinOut(1_000_000n, 0)).toBe(1_000_000n);
    });

    it('returns the same amount when slippage is negative', () => {
      expect(applySlippageToMinOut(1_000_000n, -0.001)).toBe(1_000_000n);
    });

    it('subtracts 0.2% (200 bps of 10000)', () => {
      // 1_000_000 * (1 - 0.002) = 998_000
      expect(applySlippageToMinOut(1_000_000n, 0.002)).toBe(998_000n);
    });

    it('subtracts 0.5%', () => {
      // 1_000_000 * (1 - 0.005) = 995_000
      expect(applySlippageToMinOut(1_000_000n, 0.005)).toBe(995_000n);
    });

    it('floors when the result is non-integer', () => {
      // 100_001 * 9998 / 10000 = 99_980.998... → floor to 99_980
      expect(applySlippageToMinOut(100_001n, 0.0002)).toBe(99_980n);
    });

    it('handles a 100% slippage edge case (returns 0)', () => {
      expect(applySlippageToMinOut(1_000_000n, 1)).toBe(0n);
    });
  });

  describe('computeRealisedApy', () => {
    it('returns 0 when sale price is below cost basis (loss)', () => {
      expect(
        computeRealisedApy({
          underlyingIn: 1_000_000n,
          underlyingOut: 999_000n,
          buyTime: 1_700_000_000,
          sellTime: 1_710_000_000
        })
      ).toBe(0);
    });

    it('returns 0 when holding period is zero', () => {
      expect(
        computeRealisedApy({
          underlyingIn: 1_000_000n,
          underlyingOut: 1_010_000n,
          buyTime: 1_700_000_000,
          sellTime: 1_700_000_000
        })
      ).toBe(0);
    });

    it('returns ~10% APY when holding for 1 year with 10% gain', () => {
      const SECONDS_PER_YEAR = 365 * 24 * 60 * 60;
      const apy = computeRealisedApy({
        underlyingIn: 1_000_000n,
        underlyingOut: 1_100_000n,
        buyTime: 0,
        sellTime: SECONDS_PER_YEAR
      });
      expect(apy).toBeCloseTo(0.1, 4);
    });

    it('annualises a partial-year gain', () => {
      // 5% gain over half a year ≈ 10.25% APY
      const apy = computeRealisedApy({
        underlyingIn: 1_000_000n,
        underlyingOut: 1_050_000n,
        buyTime: 0,
        sellTime: 365 * 24 * 60 * 60 * 0.5
      });
      expect(apy).toBeGreaterThan(0.1);
      expect(apy).toBeLessThan(0.105);
    });
  });

  describe('formatPendleApy', () => {
    it('formats a decimal as a percentage', () => {
      expect(formatPendleApy(0.0402)).toBe('4.02%');
    });

    it('respects fractionDigits', () => {
      expect(formatPendleApy(0.04025, 1)).toBe('4.0%');
    });

    it('handles zero', () => {
      expect(formatPendleApy(0)).toBe('0.00%');
    });
  });
});
