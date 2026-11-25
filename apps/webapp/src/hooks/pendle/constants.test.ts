import { describe, expect, it } from 'vitest';
import { PENDLE_MARKETS, getPendleMarketBySlug } from './constants';

describe('pendle market slugs', () => {
  it('every market has a unique url-safe slug', () => {
    const slugs = PENDLE_MARKETS.map(m => m.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) {
      expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  describe('getPendleMarketBySlug', () => {
    it('resolves the bare slug to the live market', () => {
      const market = getPendleMarketBySlug('pt-susds');
      expect(market?.ptSymbol).toBe('PT-sUSDS-27MAY2027');
      expect(market?.marketAddress).toBe('0x50d24456ed009a1461a159a2b4dcd12adfe6a60b');
    });

    it('resolves the dated slug to the previous market', () => {
      const market = getPendleMarketBySlug('pt-susds-26nov2026');
      expect(market?.ptSymbol).toBe('PT-sUSDS-26NOV2026');
      expect(market?.marketAddress).toBe('0x9c560ebaf78e596cbcc27411d633a74d628dd7dc');
    });

    it('returns undefined for an unknown slug', () => {
      expect(getPendleMarketBySlug('pt-does-not-exist')).toBeUndefined();
    });
  });
});
