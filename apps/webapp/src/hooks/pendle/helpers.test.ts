import { describe, expect, it } from 'vitest';
import { isMarketMatured } from './helpers';

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
});
