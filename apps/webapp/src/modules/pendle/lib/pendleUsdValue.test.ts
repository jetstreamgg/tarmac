import { describe, expect, it } from 'vitest';
import { formatUnits } from 'viem';
import type { PriceData } from '@/hooks/prices/usePrices';
import { pendleUsdValue, pendleNonPtLeg } from './pendleUsdValue';

// Minimal PriceData factory — only `price` matters to the value fn.
function price(p: string): PriceData {
  return {
    underlying_address: '0x0',
    underlying_symbol: 'X',
    price: p,
    datetime: '',
    source: 'test'
  };
}

const PRICES: Record<string, PriceData> = {
  // sUSDS is yield-bearing, > $1 — the case that breaks token-count math.
  sUSDS: price('1.05'),
  USDS: price('1.0'),
  USDC: price('0.9998')
};

const WAD = 10n ** 18n;

describe('pendleUsdValue', () => {
  describe('dollar-pegged → face value ($1), never spot', () => {
    it('values USDS at face — amount equals the token count, NOT the BaLabs spot', () => {
      // PRICES.USDS is 1.0 here, but the point is the helper short-circuits
      // pegged tokens to face regardless of the feed — see the next test.
      expect(pendleUsdValue('USDS', 1000, PRICES, undefined)).toBe(1000);
    });

    it('values USDC at face even when BaLabs quotes it off-peg (0.9998)', () => {
      // The real-world bug: a stablecoin deposit must report amount == amountFrom,
      // not get nudged by market microprice. PRICES.USDC = 0.9998 is ignored.
      expect(pendleUsdValue('USDC', 1000, PRICES, undefined)).toBe(1000);
    });

    it('values DAI at face', () => {
      expect(pendleUsdValue('DAI', 1000, PRICES, undefined)).toBe(1000);
    });
  });

  describe('BaLabs spot (non-pegged underlyings, e.g. sUSDS)', () => {
    it('prices sUSDS at spot — 1000 sUSDS × 1.05 = 1050 (NOT the 1000 token count)', () => {
      expect(pendleUsdValue('sUSDS', 1000, PRICES, undefined)).toBeCloseTo(1050, 6);
    });

    it('returns 0 for a zero amount', () => {
      expect(pendleUsdValue('sUSDS', 0, PRICES, undefined)).toBe(0);
    });
  });

  describe('chi fallback (feed unavailable)', () => {
    it('uses the on-chain sUSDS→USDS rate for sUSDS when no spot price', () => {
      // 1.05 USDS per sUSDS share, in WAD.
      const rateWad = (105n * WAD) / 100n;
      expect(pendleUsdValue('sUSDS', 1000, undefined, rateWad)).toBeCloseTo(1050, 6);
    });

    it('handles a realistic (non-round) chi rate at full 18-decimal precision', () => {
      // Real chi accrues continuously — a messy WAD, not 1.05 exactly. This
      // exercises the formatUnits(wad, 18) decimal conversion, not just the
      // branch. Derive the expected rate the same way the helper does (rather
      // than a lossy float literal) so the assertion tracks the real math.
      const rateWad = 1_051_234_567_890_123_456n; // ~1.051234567890123456
      const expectedRate = parseFloat(formatUnits(rateWad, 18));
      expect(pendleUsdValue('sUSDS', 1234.5, undefined, rateWad)).toBeCloseTo(1234.5 * expectedRate, 6);
    });

    it('handles a sub-$1 chi rate (rate < 1 WAD)', () => {
      // Defensive: a share worth less than 1 USDS must scale down, not up.
      const rateWad = 998_000_000_000_000_000n; // 0.998
      expect(pendleUsdValue('sUSDS', 1000, undefined, rateWad)).toBeCloseTo(998, 6);
    });

    it('returns undefined for sUSDS when neither spot nor chi is available', () => {
      expect(pendleUsdValue('sUSDS', 1000, undefined, undefined)).toBeUndefined();
    });

    it('returns undefined for sUSDS when chi is 0n (uninitialized read)', () => {
      // A failed/empty convertToAssets read can surface as 0n — that must not
      // value the leg at $0 and pollute flow totals; omit instead.
      expect(pendleUsdValue('sUSDS', 1000, undefined, 0n)).toBeUndefined();
    });

    it('returns undefined for an unknown non-pegged token with no spot', () => {
      expect(pendleUsdValue('WETH', 1, undefined, undefined)).toBeUndefined();
    });

    it('prefers spot over chi when both are present', () => {
      const rateWad = (200n * WAD) / 100n; // 2.0 — deliberately wrong vs spot 1.05
      expect(pendleUsdValue('sUSDS', 1000, PRICES, rateWad)).toBeCloseTo(1050, 6);
    });
  });

  describe('defensive', () => {
    it('returns undefined for a non-finite amount', () => {
      expect(pendleUsdValue('USDS', NaN, PRICES, undefined)).toBeUndefined();
    });

    it('ignores a non-numeric spot string and falls through to fallback', () => {
      const bad: Record<string, PriceData> = { sUSDS: price('not-a-number') };
      const rateWad = (105n * WAD) / 100n;
      expect(pendleUsdValue('sUSDS', 1000, bad, rateWad)).toBeCloseTo(1050, 6);
    });

    // The `typeof === 'bigint'` guard prevents a BigInt-mixing TypeError if a
    // non-bigint ever reaches the chi path (e.g. a wagmi shape change). It must
    // degrade to undefined, not throw.
    it('returns undefined (no throw) when chi is not a bigint', () => {
      const notABigint = '123' as unknown as bigint;
      expect(pendleUsdValue('sUSDS', 1000, undefined, notABigint)).toBeUndefined();
    });
  });
});

describe('pendleNonPtLeg', () => {
  it('BUY → values the input (origin) token', () => {
    const leg = pendleNonPtLeg('buy', {
      originSymbol: 'sUSDS',
      targetSymbol: 'PT-sUSDS',
      amountInBigint: 1000n * WAD,
      amountOutBigint: 1020n * WAD,
      fromDecimals: 18,
      toDecimals: 18
    });
    expect(leg).toEqual({ symbol: 'sUSDS', amount: 1000 });
  });

  it('SELL → values the output (target) token, not PT', () => {
    const leg = pendleNonPtLeg('sell', {
      originSymbol: 'PT-sUSDS',
      targetSymbol: 'USDS',
      amountInBigint: 1000n * WAD, // PT in
      amountOutBigint: 1040n * WAD, // USDS out
      fromDecimals: 18,
      toDecimals: 18
    });
    expect(leg).toEqual({ symbol: 'USDS', amount: 1040 });
  });

  it('REDEEM → values the output (target) token', () => {
    const leg = pendleNonPtLeg('redeem', {
      originSymbol: 'PT-sUSDS',
      targetSymbol: 'USDC',
      amountInBigint: 1000n * WAD, // PT in (18dp)
      amountOutBigint: 1050_000_000n, // 1050 USDC out (6dp)
      fromDecimals: 18,
      toDecimals: 6
    });
    expect(leg).toEqual({ symbol: 'USDC', amount: 1050 });
  });

  it('returns a positive magnitude — sign is applied by the caller', () => {
    const leg = pendleNonPtLeg('sell', {
      originSymbol: 'PT-sUSDS',
      targetSymbol: 'USDS',
      amountInBigint: 1n,
      amountOutBigint: 5n * WAD,
      fromDecimals: 18,
      toDecimals: 18
    });
    expect(leg.amount).toBeGreaterThan(0);
  });
});
