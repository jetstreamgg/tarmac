import { afterEach, describe, expect, it } from 'vitest';
import { PENDLE_MARKETS, getListedPendleMarkets, getPendleMarketBySlug } from './constants';

describe('pendle market slugs', () => {
  it('every market has a unique url-safe slug', () => {
    const slugs = PENDLE_MARKETS.map(m => m.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) {
      expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  describe('getPendleMarketBySlug', () => {
    it('resolves a known slug to its market', () => {
      const market = getPendleMarketBySlug('pt-susds');
      expect(market?.marketAddress).toBe('0x9c560ebaf78e596cbcc27411d633a74d628dd7dc');
    });

    it('returns undefined for an unknown slug', () => {
      expect(getPendleMarketBySlug('pt-does-not-exist')).toBeUndefined();
    });
  });
});

describe('a successor market shipped ahead of its listFrom', () => {
  const predecessor = PENDLE_MARKETS[0];
  const LIST_FROM = predecessor.expiry;
  const successor = {
    ...predecessor,
    slug: 'pt-successor',
    marketAddress: '0x00000000000000000000000000000000000000aa' as const,
    ptToken: '0x00000000000000000000000000000000000000ab' as const,
    expiry: LIST_FROM + 180 * 86_400,
    listFrom: LIST_FROM
  };
  const originalLength = PENDLE_MARKETS.length;
  const addSuccessor = () => PENDLE_MARKETS.push(successor);

  afterEach(() => {
    PENDLE_MARKETS.length = originalLength;
  });

  it('stays out of the listed markets until listFrom', () => {
    addSuccessor();
    expect(getListedPendleMarkets(LIST_FROM - 1)).not.toContain(successor);
    expect(getListedPendleMarkets(LIST_FROM)).toContain(successor);
  });

  it('hands its slug to the predecessor until listFrom, then takes it', () => {
    addSuccessor();
    expect(getPendleMarketBySlug('pt-successor', LIST_FROM - 1)).toBe(predecessor);
    expect(getPendleMarketBySlug('pt-successor', LIST_FROM)).toBe(successor);
  });

  it('keeps the predecessor reachable by its own slug after the handover', () => {
    addSuccessor();
    expect(getPendleMarketBySlug(predecessor.slug, LIST_FROM)).toBe(predecessor);
  });

  it('does not resolve an unlisted slug with no listed market on the same underlying', () => {
    PENDLE_MARKETS.push({
      ...successor,
      underlyingToken: '0x00000000000000000000000000000000000000ac'
    });
    expect(getPendleMarketBySlug('pt-successor', LIST_FROM - 1)).toBeUndefined();
  });
});
