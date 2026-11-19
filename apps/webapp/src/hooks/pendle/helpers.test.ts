import { describe, expect, it } from 'vitest';
import { isMarketListed, isMarketMatured, maturedPendleMarketName, pendlePtTicker } from './helpers';

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

  describe('isMarketListed', () => {
    it('lists a market without listFrom', () => {
      expect(isMarketListed({}, 0)).toBe(true);
    });

    it('lists a market from its listFrom instant on', () => {
      expect(isMarketListed({ listFrom: 1000 }, 999)).toBe(false);
      expect(isMarketListed({ listFrom: 1000 }, 1000)).toBe(true);
    });
  });

  describe('maturedPendleMarketName', () => {
    it('appends the UTC maturity month to the product name', () => {
      expect(maturedPendleMarketName({ name: 'Fixed Yield', expiry: 1795651200 })).toBe(
        'Fixed Yield · Nov 2026'
      );
    });
  });

  describe('pendlePtTicker', () => {
    it('appends the UTC maturity in Pendle symbol form', () => {
      expect(pendlePtTicker({ underlyingSymbol: 'sUSDS', expiry: 1795651200 })).toBe('PT-sUSDS-26NOV2026');
    });

    it('zero-pads the day, as the on-chain symbol does', () => {
      // Thu Jun 04 2026 00:00:00 UTC
      expect(pendlePtTicker({ underlyingSymbol: 'sUSDS', expiry: 1780531200 })).toBe('PT-sUSDS-04JUN2026');
    });
  });
});
