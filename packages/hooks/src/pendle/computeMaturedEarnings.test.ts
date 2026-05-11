import { describe, expect, it } from 'vitest';
import { computeMaturedEarnings } from './computeMaturedEarnings';
import { PendleTradeAction } from './constants';
import type { PendleMarketConfig, PendleTransactionRaw } from './pendle';

const DAY = 86_400;
const EXPIRY = 2_000_000_000;
const CHI_ONE_TO_ONE = 1_000_000_000_000_000_000n; // 1.0 in 1e18 fixed-point
const CHI_1_05 = 1_050_000_000_000_000_000n; // 1.05 sUSDS→USDS rate

const PEGGED_MARKET: PendleMarketConfig = {
  name: 'PT-USDG',
  marketAddress: '0xc5b32dba5f29f8395fb9591e1a15f23a75214f33',
  ptToken: '0x9db38D74a0D29380899aD354121DfB521aDb0548',
  ytToken: '0x4a1294749A70bc32A998B49dd11Bf26E9379e3C1',
  syToken: '0xc1799CaB1F201946f7CFaFBaF1BCC089b2F08927',
  underlyingToken: '0xe343167631d89B6Ffc58B88d6b7fB0228795491D',
  underlyingSymbol: 'USDG',
  underlyingDecimals: 6,
  expiry: EXPIRY,
  usdsEquivalence: 'pegged'
};

const SUSDS_MARKET: PendleMarketConfig = {
  ...PEGGED_MARKET,
  name: 'PT-sUSDS',
  underlyingSymbol: 'sUSDS',
  underlyingDecimals: 18,
  usdsEquivalence: 'sUSDS'
};

const TIER3_MARKET: PendleMarketConfig = {
  ...PEGGED_MARKET,
  name: 'PT-sENA',
  underlyingSymbol: 'sENA',
  underlyingDecimals: 18,
  usdsEquivalence: undefined
};

let _idCounter = 0;
function nextId() {
  _idCounter += 1;
  return `tx-${_idCounter}`;
}

function makeTrade(
  action: PendleTradeAction,
  opts: { secondsBeforeExpiry: number; value: number; pt?: number; market?: PendleMarketConfig }
): PendleTransactionRaw {
  const market = opts.market ?? PEGGED_MARKET;
  return {
    id: nextId(),
    market: market.marketAddress,
    timestamp: new Date((EXPIRY - opts.secondsBeforeExpiry) * 1000).toISOString(),
    chainId: 1,
    txHash: '0xabc',
    value: opts.value,
    type: 'TRADES',
    action,
    txOrigin: '0x0',
    impliedApy: 0,
    notional: { pt: opts.pt ?? opts.value }
  };
}

const buy = (opts: Parameters<typeof makeTrade>[1]) => makeTrade(PendleTradeAction.BUY_PT, opts);
const sell = (opts: Parameters<typeof makeTrade>[1]) => makeTrade(PendleTradeAction.SELL_PT, opts);

// Underlying-token units → bigint, respecting market decimals.
function toUnderlying(amount: number, market: PendleMarketConfig): bigint {
  return BigInt(Math.round(amount * 10 ** market.underlyingDecimals));
}

const EMPTY = { earnings: undefined, apy: undefined, currency: undefined };

describe('computeMaturedEarnings', () => {
  it('returns empty when history is an empty array', () => {
    expect(
      computeMaturedEarnings({
        history: [],
        previewAmount: toUnderlying(1000, PEGGED_MARKET),
        chi: undefined,
        market: PEGGED_MARKET,
        effectiveTier: 'pegged'
      })
    ).toEqual(EMPTY);
  });

  it('returns empty when history has no BUY_PT actions (transferred-in PT)', () => {
    expect(
      computeMaturedEarnings({
        history: [sell({ secondsBeforeExpiry: 90 * DAY, value: 500 })],
        previewAmount: toUnderlying(1000, PEGGED_MARKET),
        chi: undefined,
        market: PEGGED_MARKET,
        effectiveTier: 'pegged'
      })
    ).toEqual(EMPTY);
  });

  it('returns empty when previewAmount is undefined', () => {
    expect(
      computeMaturedEarnings({
        history: [buy({ secondsBeforeExpiry: 90 * DAY, value: 1000 })],
        previewAmount: undefined,
        chi: undefined,
        market: PEGGED_MARKET,
        effectiveTier: 'pegged'
      })
    ).toEqual(EMPTY);
  });

  it('returns empty when effectiveTier is undefined (no honest math without equivalence rule)', () => {
    expect(
      computeMaturedEarnings({
        history: [buy({ secondsBeforeExpiry: 90 * DAY, value: 1000 })],
        previewAmount: toUnderlying(1010, TIER3_MARKET),
        chi: undefined,
        market: TIER3_MARKET,
        effectiveTier: undefined
      })
    ).toEqual(EMPTY);
  });

  it('pegged path: single buy, no sell — returns positive earnings, apy, USDS currency', () => {
    const result = computeMaturedEarnings({
      history: [buy({ secondsBeforeExpiry: 90 * DAY, value: 1000 })],
      previewAmount: toUnderlying(1010, PEGGED_MARKET),
      chi: undefined,
      market: PEGGED_MARKET,
      effectiveTier: 'pegged'
    });
    expect(result.currency).toBe('USDS');
    expect(result.earnings).toBeGreaterThan(0);
    expect(result.earnings).toBeCloseTo(10, 4); // 1010 received − 1000 spent
    expect(result.apy).toBeGreaterThan(0);
  });

  it('sUSDS path: chi=1.05 multiplies the receive amount', () => {
    // 1000 sUSDS received × 1.05 USDS/sUSDS = 1050 USDS final value
    const result = computeMaturedEarnings({
      history: [buy({ secondsBeforeExpiry: 90 * DAY, value: 1000, market: SUSDS_MARKET })],
      previewAmount: toUnderlying(1000, SUSDS_MARKET),
      chi: CHI_1_05,
      market: SUSDS_MARKET,
      effectiveTier: 'sUSDS'
    });
    expect(result.currency).toBe('USDS');
    expect(result.earnings).toBeCloseTo(50, 4); // 1050 − 1000 cost
  });

  it('sUSDS path with chi=1 still applies the multiplication path (no shortcut)', () => {
    const result = computeMaturedEarnings({
      history: [buy({ secondsBeforeExpiry: 90 * DAY, value: 1000, market: SUSDS_MARKET })],
      previewAmount: toUnderlying(1000, SUSDS_MARKET),
      chi: CHI_ONE_TO_ONE,
      market: SUSDS_MARKET,
      effectiveTier: 'sUSDS'
    });
    expect(result.earnings).toBeCloseTo(0, 4); // 1000 × 1.0 − 1000
  });

  it('returns empty on sUSDS path when chi is undefined', () => {
    expect(
      computeMaturedEarnings({
        history: [buy({ secondsBeforeExpiry: 90 * DAY, value: 1000, market: SUSDS_MARKET })],
        previewAmount: toUnderlying(1000, SUSDS_MARKET),
        chi: undefined,
        market: SUSDS_MARKET,
        effectiveTier: 'sUSDS'
      })
    ).toEqual(EMPTY);
  });

  it('currency selection: tier-3 market coerced into pegged falls back to underlyingSymbol', () => {
    // Mirrors the Tenderly TEMP path: market.usdsEquivalence is undefined, but
    // the hook layer passed effectiveTier='pegged' so the line renders.
    const result = computeMaturedEarnings({
      history: [buy({ secondsBeforeExpiry: 90 * DAY, value: 1000, market: TIER3_MARKET })],
      previewAmount: toUnderlying(1010, TIER3_MARKET),
      chi: undefined,
      market: TIER3_MARKET,
      effectiveTier: 'pegged'
    });
    expect(result.currency).toBe('sENA');
    expect(result.earnings).toBeCloseTo(10, 4);
  });

  it('APY sanity check: 180-day hold with 4% gross return lands near 8% APY', () => {
    // 1000 spent on day -180; matures to 1040.
    // APY = (1040/1000)^(365/180) − 1 ≈ 8.28%
    const result = computeMaturedEarnings({
      history: [buy({ secondsBeforeExpiry: 180 * DAY, value: 1000 })],
      previewAmount: toUnderlying(1040, PEGGED_MARKET),
      chi: undefined,
      market: PEGGED_MARKET,
      effectiveTier: 'pegged'
    });
    expect(result.apy).toBeDefined();
    expect(result.apy!).toBeGreaterThan(0.05);
    expect(result.apy!).toBeLessThan(0.1);
    expect(result.apy!).toBeCloseTo(0.0828, 3);
  });

  it('returns empty when net cost is zero (sells fully recovered the buys)', () => {
    // Edge case from existing code: netCostUsd <= 0 → empty
    expect(
      computeMaturedEarnings({
        history: [
          buy({ secondsBeforeExpiry: 90 * DAY, value: 1000 }),
          sell({ secondsBeforeExpiry: 60 * DAY, value: 1000 })
        ],
        previewAmount: toUnderlying(50, PEGGED_MARKET),
        chi: undefined,
        market: PEGGED_MARKET,
        effectiveTier: 'pegged'
      })
    ).toEqual(EMPTY);
  });
});
