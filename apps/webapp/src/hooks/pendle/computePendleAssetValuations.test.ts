import { describe, expect, it } from 'vitest';
import { computePendleAssetValuations, ptDiscount } from './computePendleAssetValuations';
import type { PendleMarketConfig, PendleMarketStats } from './pendle';

const SECONDS_PER_YEAR = 365.25 * 86400;
const NOW = 1_700_000_000;

const PT_USDG: PendleMarketConfig = {
  name: 'PT-USDG',
  marketAddress: '0xc5b32dba5f29f8395fb9591e1a15f23a75214f33',
  ptToken: '0x9db38D74a0D29380899aD354121DfB521aDb0548',
  ytToken: '0x4a1294749A70bc32A998B49dd11Bf26E9379e3C1',
  syToken: '0xc1799CaB1F201946f7CFaFBaF1BCC089b2F08927',
  underlyingToken: '0xe343167631d89B6Ffc58B88d6b7fB0228795491D',
  underlyingSymbol: 'USDG',
  underlyingDecimals: 6,
  expiry: NOW + SECONDS_PER_YEAR / 2, // 6 months out
  usdsEquivalence: 'pegged'
};

const PT_SUSDS: PendleMarketConfig = {
  name: 'PT-sUSDS',
  marketAddress: '0x1111111111111111111111111111111111111111',
  ptToken: '0x2222222222222222222222222222222222222222',
  ytToken: '0x3333333333333333333333333333333333333333',
  syToken: '0x4444444444444444444444444444444444444444',
  underlyingToken: '0x5555555555555555555555555555555555555555',
  underlyingSymbol: 'sUSDS',
  underlyingDecimals: 18,
  expiry: NOW + SECONDS_PER_YEAR, // 1 year out
  usdsEquivalence: 'sUSDS'
};

const PT_MATURED: PendleMarketConfig = {
  ...PT_USDG,
  name: 'PT-MATURED',
  marketAddress: '0x6666666666666666666666666666666666666666',
  expiry: NOW - 60 // matured a minute ago
};

function stats(impliedApy: number): PendleMarketStats {
  return { impliedApy } as PendleMarketStats;
}

describe('ptDiscount', () => {
  it('returns 1 at maturity (and after)', () => {
    expect(ptDiscount(0.05, NOW, NOW)).toBe(1);
    expect(ptDiscount(0.05, NOW - 1, NOW)).toBe(1);
  });

  it('returns 1 when impliedApy is undefined (loading) — face-value fallback', () => {
    expect(ptDiscount(undefined, NOW + SECONDS_PER_YEAR, NOW)).toBe(1);
  });

  it('returns 1 when impliedApy is NaN — defensive', () => {
    expect(ptDiscount(NaN, NOW + SECONDS_PER_YEAR, NOW)).toBe(1);
  });

  it('discounts a 1-year, 5% APY PT to ~0.952', () => {
    const d = ptDiscount(0.05, NOW + SECONDS_PER_YEAR, NOW);
    expect(d).toBeCloseTo(1 / 1.05, 6);
  });

  it('discounts a 6-month, 5% APY PT to ~0.976', () => {
    const d = ptDiscount(0.05, NOW + SECONDS_PER_YEAR / 2, NOW);
    expect(d).toBeCloseTo(Math.pow(1.05, -0.5), 6);
  });

  it('handles negative impliedApy (rare but valid — PT trading above underlying)', () => {
    const d = ptDiscount(-0.02, NOW + SECONDS_PER_YEAR, NOW);
    expect(d).toBeGreaterThan(1);
  });
});

describe('computePendleAssetValuations', () => {
  it('returns empty data when ptBalances is undefined', () => {
    const out = computePendleAssetValuations({
      ptBalances: undefined,
      usdsPrice: 1,
      sUsdsPrice: 1.05,
      marketsApi: undefined,
      nowSec: NOW
    });
    expect(out).toEqual({ total: 0n, totalUsd: 0, markets: [] });
  });

  it('skips markets where the user holds 0 PT', () => {
    const out = computePendleAssetValuations(
      {
        ptBalances: { [PT_USDG.marketAddress]: 0n },
        usdsPrice: 1,
        sUsdsPrice: 1.05,
        marketsApi: { [PT_USDG.marketAddress]: stats(0.05) },
        nowSec: NOW
      },
      [PT_USDG]
    );
    expect(out.markets).toEqual([]);
  });

  it('applies the impliedApy discount to a pegged-USDS market', () => {
    // 6-month, 5% APY → discount ≈ 0.9759
    // Balance 1000 USDG (1_000_000_000n with 6 decimals) → MTM ≈ $975.90
    const out = computePendleAssetValuations(
      {
        ptBalances: { [PT_USDG.marketAddress]: 1_000_000_000n },
        usdsPrice: 1,
        sUsdsPrice: 0,
        marketsApi: { [PT_USDG.marketAddress]: stats(0.05) },
        nowSec: NOW
      },
      [PT_USDG]
    );
    expect(out.markets).toHaveLength(1);
    expect(out.markets[0].valuationUsd).toBeCloseTo(1000 * Math.pow(1.05, -0.5), 4);
    expect(out.totalUsd).toBeCloseTo(1000 * Math.pow(1.05, -0.5), 4);
  });

  it('applies the impliedApy discount to a sUSDS market', () => {
    // 1-year, 4% APY → discount ≈ 0.9615
    // Balance 1 PT (1e18) × sUsdsPrice 1.05 × discount ≈ $1.0096
    const out = computePendleAssetValuations(
      {
        ptBalances: { [PT_SUSDS.marketAddress]: 1_000_000_000_000_000_000n },
        usdsPrice: 0,
        sUsdsPrice: 1.05,
        marketsApi: { [PT_SUSDS.marketAddress]: stats(0.04) },
        nowSec: NOW
      },
      [PT_SUSDS]
    );
    expect(out.markets[0].valuationUsd).toBeCloseTo(1.05 / 1.04, 4);
  });

  it('values matured markets at face × underlying spot (discount = 1)', () => {
    const out = computePendleAssetValuations(
      {
        ptBalances: { [PT_MATURED.marketAddress]: 1_000_000n }, // 1 token at 6 dec
        usdsPrice: 1,
        sUsdsPrice: 0,
        marketsApi: { [PT_MATURED.marketAddress]: stats(0.05) }, // ignored — matured
        nowSec: NOW
      },
      [PT_MATURED]
    );
    expect(out.markets[0].valuationUsd).toBe(1);
  });

  it('falls back to face value when impliedApy is missing (loading state)', () => {
    // No marketsApi entry for this market → discount = 1 → face value displayed
    const out = computePendleAssetValuations(
      {
        ptBalances: { [PT_USDG.marketAddress]: 1_000_000_000n },
        usdsPrice: 1,
        sUsdsPrice: 0,
        marketsApi: undefined,
        nowSec: NOW
      },
      [PT_USDG]
    );
    expect(out.markets[0].valuationUsd).toBe(1000); // face value
  });

  it('sums valuations across markets', () => {
    const out = computePendleAssetValuations(
      {
        ptBalances: {
          [PT_USDG.marketAddress]: 1_000_000_000n,
          [PT_SUSDS.marketAddress]: 1_000_000_000_000_000_000n
        },
        usdsPrice: 1,
        sUsdsPrice: 1.05,
        marketsApi: {
          [PT_USDG.marketAddress]: stats(0.05),
          [PT_SUSDS.marketAddress]: stats(0.04)
        },
        nowSec: NOW
      },
      [PT_USDG, PT_SUSDS]
    );
    const expectedUsdg = 1000 * Math.pow(1.05, -0.5);
    const expectedSusds = 1.05 / 1.04;
    expect(out.totalUsd).toBeCloseTo(expectedUsdg + expectedSusds, 4);
    expect(out.markets).toHaveLength(2);
  });

  it('returns 0 valuation when underlying price is 0 (no price feed)', () => {
    const out = computePendleAssetValuations(
      {
        ptBalances: { [PT_USDG.marketAddress]: 1_000_000_000n },
        usdsPrice: 0,
        sUsdsPrice: 0,
        marketsApi: { [PT_USDG.marketAddress]: stats(0.05) },
        nowSec: NOW
      },
      [PT_USDG]
    );
    expect(out.markets[0].valuationUsd).toBe(0);
  });

  it('normalizes PT balance to 18 decimals for the `total` field regardless of underlying decimals', () => {
    // PT-USDG balance of 1_000_000 (1 token at 6 decimals) → 1e18 normalized.
    const out = computePendleAssetValuations(
      {
        ptBalances: { [PT_USDG.marketAddress]: 1_000_000n },
        usdsPrice: 1,
        sUsdsPrice: 0,
        marketsApi: { [PT_USDG.marketAddress]: stats(0.05) },
        nowSec: NOW
      },
      [PT_USDG]
    );
    expect(out.total).toBe(1_000_000_000_000_000_000n);
    expect(out.markets[0].ptBalance).toBe(1_000_000n);
    expect(out.markets[0].ptBalanceNormalized).toBe(1_000_000_000_000_000_000n);
  });
});
