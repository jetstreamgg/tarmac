import { describe, expect, it } from 'vitest';
import { isMarketMatured, maturedPendleMarketName } from './helpers';

describe('pendle helpers', () => {
  describe('isMarketMatured', () => {
    it('returns false when expiry is in the future', () => {
      const now = Math.floor(Date.now() / 1000);
      expect(isMarketMatured(now + 60_000)).toBe(false);
    });

    it('returns true when expiry is in the past', () => {
      const now = Math.floor(Date.now() / 1000);
      expect(isMarketMatured(now - 60_000)).toBe(true);
    });
  });

  describe('maturedPendleMarketName', () => {
    it('appends the UTC maturity month to the product name', () => {
      expect(maturedPendleMarketName({ name: 'Fixed Yield', expiry: 1795651200 })).toBe(
        'Fixed Yield · Nov 2026'
      );
    });
  });
});
