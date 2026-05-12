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
  opts: {
    secondsBeforeExpiry: number;
    value: number;
    pt?: number;
    market?: PendleMarketConfig;
    notional?: PendleTransactionRaw['notional'];
  }
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
    notional: 'notional' in opts ? opts.notional : { pt: opts.pt ?? opts.value }
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
    // No trades → netPT = 0 vs ptBalanceFloat = 1000 fails the reconciliation
    // gate. (Pre-slice-02 this hit the explicit "no buys" early return; the
    // observable behavior is unchanged.)
    expect(
      computeMaturedEarnings({
        history: [],
        previewAmount: toUnderlying(1000, PEGGED_MARKET),
        chi: undefined,
        market: PEGGED_MARKET,
        effectiveTier: 'pegged',
        ptBalanceFloat: 1000
      })
    ).toEqual(EMPTY);
  });

  it('returns empty when history has no BUY_PT actions (transferred-in PT)', () => {
    // sells without buys → netPT = -500 vs ptBalanceFloat = 1000 → fails gate.
    expect(
      computeMaturedEarnings({
        history: [sell({ secondsBeforeExpiry: 90 * DAY, value: 500 })],
        previewAmount: toUnderlying(1000, PEGGED_MARKET),
        chi: undefined,
        market: PEGGED_MARKET,
        effectiveTier: 'pegged',
        ptBalanceFloat: 1000
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
        effectiveTier: 'pegged',
        ptBalanceFloat: 1000
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
        effectiveTier: undefined,
        ptBalanceFloat: 1000
      })
    ).toEqual(EMPTY);
  });

  it('pegged path: single buy, no sell — returns positive earnings, apy, USDS currency', () => {
    const result = computeMaturedEarnings({
      history: [buy({ secondsBeforeExpiry: 90 * DAY, value: 1000 })],
      previewAmount: toUnderlying(1010, PEGGED_MARKET),
      chi: undefined,
      market: PEGGED_MARKET,
      effectiveTier: 'pegged',
      ptBalanceFloat: 1000
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
      effectiveTier: 'sUSDS',
      ptBalanceFloat: 1000
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
      effectiveTier: 'sUSDS',
      ptBalanceFloat: 1000
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
        effectiveTier: 'sUSDS',
        ptBalanceFloat: 1000
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
      effectiveTier: 'pegged',
      ptBalanceFloat: 1000
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
      effectiveTier: 'pegged',
      ptBalanceFloat: 1000
    });
    expect(result.apy).toBeDefined();
    expect(result.apy!).toBeGreaterThan(0.05);
    expect(result.apy!).toBeLessThan(0.1);
    expect(result.apy!).toBeCloseTo(0.0828, 3);
  });

  it('returns empty when net cost is zero or negative (price spike: sells recovered more than buys spent)', () => {
    // User bought 1000 PT for $1000, sold 500 PT for $1500 (price spike), still
    // holds 500 PT. Reconciliation passes (1000 − 500 = 500 ≈ ptBalanceFloat).
    // netCostUsd = 1000 − 1500 = -500 → empty via the netCost<=0 guard.
    expect(
      computeMaturedEarnings({
        history: [
          buy({ secondsBeforeExpiry: 90 * DAY, value: 1000, pt: 1000 }),
          sell({ secondsBeforeExpiry: 60 * DAY, value: 1500, pt: 500 })
        ],
        previewAmount: toUnderlying(550, PEGGED_MARKET),
        chi: undefined,
        market: PEGGED_MARKET,
        effectiveTier: 'pegged',
        ptBalanceFloat: 500
      })
    ).toEqual(EMPTY);
  });
});

describe('computeMaturedEarnings — reconciliation gate (slice 02)', () => {
  it('reconciles when notional.pt sums match ptBalanceFloat exactly (1 buy, 0 sells)', () => {
    const result = computeMaturedEarnings({
      history: [buy({ secondsBeforeExpiry: 90 * DAY, value: 1000, pt: 1000 })],
      previewAmount: toUnderlying(1010, PEGGED_MARKET),
      chi: undefined,
      market: PEGGED_MARKET,
      effectiveTier: 'pegged',
      ptBalanceFloat: 1000
    });
    expect(result.earnings).toBeCloseTo(10, 4);
    expect(result.currency).toBe('USDS');
  });

  it('hides earnings on partial transfer-in (Pendle accounts for 50%, the rest came from elsewhere)', () => {
    // netPtFromPendle = 50, ptBalanceFloat = 100 → 50% drift, far above 1% tolerance.
    expect(
      computeMaturedEarnings({
        history: [buy({ secondsBeforeExpiry: 90 * DAY, value: 50, pt: 50 })],
        previewAmount: toUnderlying(105, PEGGED_MARKET),
        chi: undefined,
        market: PEGGED_MARKET,
        effectiveTier: 'pegged',
        ptBalanceFloat: 100
      })
    ).toEqual(EMPTY);
  });

  it('tolerates shortfall (netPT > balance): interpreted as redeem, with prorated cost basis', () => {
    // Review-fix slice 02 changed the contract: shortfall is no longer hidden.
    // Pendle's TRADES API doesn't index post-maturity redeems, so a balance
    // below Pendle's view is most likely a redeem (not a gift-out). We
    // interpret it that way and prorate the cost basis. Bought 100 PT for
    // $100, balance = 80 (assume 20 redeemed). remainingFraction = 0.8 →
    // proratedNetCost = $80 → preview 82 USDG → earnings = $2.
    const result = computeMaturedEarnings({
      history: [buy({ secondsBeforeExpiry: 90 * DAY, value: 100, pt: 100 })],
      previewAmount: toUnderlying(82, PEGGED_MARKET),
      chi: undefined,
      market: PEGGED_MARKET,
      effectiveTier: 'pegged',
      ptBalanceFloat: 80
    });
    expect(result.earnings).toBeCloseTo(2, 4);
    expect(result.currency).toBe('USDS');
    expect(result.apy).toBeDefined();
  });

  it('hides earnings when notional.pt is missing on some BUY trades (safe fallback)', () => {
    // Two buys totaling 1000 PT, but the API omitted notional on one of them.
    // The omitted entry contributes 0 to the sum → netPtFromPendle = 500 vs
    // ptBalanceFloat = 1000 → 50% drift → empty. Asserts the conservative
    // failure mode when API data is malformed.
    expect(
      computeMaturedEarnings({
        history: [
          buy({ secondsBeforeExpiry: 90 * DAY, value: 500, pt: 500 }),
          buy({ secondsBeforeExpiry: 60 * DAY, value: 500, notional: undefined })
        ],
        previewAmount: toUnderlying(1010, PEGGED_MARKET),
        chi: undefined,
        market: PEGGED_MARKET,
        effectiveTier: 'pegged',
        ptBalanceFloat: 1000
      })
    ).toEqual(EMPTY);
  });

  it('hides earnings on pagination overflow (>100 trades; older buys missing from API window)', () => {
    // Simulate the API's 100-trade cap: the user really has 100 buys totaling
    // 10000 PT, but the API only returned the most recent 50 totaling 5000 PT.
    // To the pure function this looks identical to a partial transfer-in.
    const truncatedHistory = Array.from({ length: 50 }, (_, i) =>
      buy({ secondsBeforeExpiry: (90 - i) * DAY, value: 100, pt: 100 })
    );
    expect(
      computeMaturedEarnings({
        history: truncatedHistory,
        previewAmount: toUnderlying(10100, PEGGED_MARKET),
        chi: undefined,
        market: PEGGED_MARKET,
        effectiveTier: 'pegged',
        ptBalanceFloat: 10000
      })
    ).toEqual(EMPTY);
  });

  it('reconciles within tolerance: 0.5% drift still shows earnings', () => {
    // netPtFromPendle = 100, ptBalanceFloat = 100.5 → |1 - 100/100.5| ≈ 0.005 < 0.01
    const result = computeMaturedEarnings({
      history: [buy({ secondsBeforeExpiry: 90 * DAY, value: 100, pt: 100 })],
      previewAmount: toUnderlying(101, PEGGED_MARKET),
      chi: undefined,
      market: PEGGED_MARKET,
      effectiveTier: 'pegged',
      ptBalanceFloat: 100.5
    });
    expect(result.earnings).toBeCloseTo(1, 4);
  });

  it('rejects at the tolerance boundary: 1.1% drift hides earnings', () => {
    // netPtFromPendle = 100, ptBalanceFloat = 101.1 → |1 - 100/101.1| ≈ 0.0109 >= 0.01
    expect(
      computeMaturedEarnings({
        history: [buy({ secondsBeforeExpiry: 90 * DAY, value: 100, pt: 100 })],
        previewAmount: toUnderlying(102, PEGGED_MARKET),
        chi: undefined,
        market: PEGGED_MARKET,
        effectiveTier: 'pegged',
        ptBalanceFloat: 101.1
      })
    ).toEqual(EMPTY);
  });

  it('returns empty when ptBalanceFloat is 0 (user holds nothing on-chain)', () => {
    // Even with valid Pendle history, a zero balance means there's nothing
    // matured to compute earnings against — early-return before the division.
    expect(
      computeMaturedEarnings({
        history: [buy({ secondsBeforeExpiry: 90 * DAY, value: 1000, pt: 1000 })],
        previewAmount: toUnderlying(1010, PEGGED_MARKET),
        chi: undefined,
        market: PEGGED_MARKET,
        effectiveTier: 'pegged',
        ptBalanceFloat: 0
      })
    ).toEqual(EMPTY);
  });
});

describe('computeMaturedEarnings — PT decimals = underlying decimals (review-fix slice 01)', () => {
  // Regression coverage for PR #1546 review feedback. PT tokens inherit their
  // underlying's decimals; an earlier draft assumed PT was universally
  // 18-decimal and silently broke PT-USDG (6-decimal) reconciliation at the
  // hook layer. The pure function takes ptBalanceFloat already-converted, so
  // these tests assert that the function's contract is decimals-agnostic and
  // the caller (the hook) can hand in correctly-scaled floats for either
  // market.
  const PT_USDG_MARKET: PendleMarketConfig = {
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

  const PT_SUSDS_MARKET: PendleMarketConfig = {
    ...PT_USDG_MARKET,
    name: 'PT-sUSDS',
    underlyingSymbol: 'sUSDS',
    underlyingDecimals: 18,
    usdsEquivalence: 'pegged' // treat as pegged for this fixture so chi is irrelevant
  };

  it('PT-USDG (6-decimal underlying): reconciles and renders earnings', () => {
    // Simulates the on-chain conversion the hook performs:
    //   ptBalance = 1000n * 10n**6n  →  Number(...) / 10**6 = 1000.
    // Pre-fix this was the silently-broken market: 1e18 divisor turned the
    // 6-decimal balance into 1e-9 and the gate hid the line forever.
    const result = computeMaturedEarnings({
      history: [buy({ secondsBeforeExpiry: 90 * DAY, value: 1000, pt: 1000, market: PT_USDG_MARKET })],
      previewAmount: toUnderlying(1010, PT_USDG_MARKET),
      chi: undefined,
      market: PT_USDG_MARKET,
      effectiveTier: 'pegged',
      ptBalanceFloat: 1000
    });
    expect(result.currency).toBe('USDS');
    expect(result.earnings).toBeCloseTo(10, 4);
    expect(result.apy).toBeGreaterThan(0);
  });

  it('PT-sUSDS (18-decimal underlying): unchanged production-target behavior', () => {
    // Confirms the decimals fix doesn't regress the market that always worked.
    // ptBalance = 1000n * 10n**18n  →  1000.
    const result = computeMaturedEarnings({
      history: [buy({ secondsBeforeExpiry: 90 * DAY, value: 1000, pt: 1000, market: PT_SUSDS_MARKET })],
      previewAmount: toUnderlying(1010, PT_SUSDS_MARKET),
      chi: undefined,
      market: PT_SUSDS_MARKET,
      effectiveTier: 'pegged',
      ptBalanceFloat: 1000
    });
    expect(result.currency).toBe('USDS');
    expect(result.earnings).toBeCloseTo(10, 4);
    expect(result.apy).toBeGreaterThan(0);
  });
});

describe('computeMaturedEarnings — redeem handling (review-fix slice 02)', () => {
  // Pendle's TRADES API doesn't index post-maturity redeems (redeemPyToToken
  // calls reduce on-chain balance but don't appear as SELL_PT). The
  // reconciliation gate is asymmetric:
  //   - balance > netPt * 1.01: surplus has unknown cost basis → hide.
  //   - balance < netPt: interpret as redeem, prorate cost basis to remaining.
  //   - within ±1% drift: Math.min(1, ratio) cap collapses to un-prorated math.
  // See PR #1546 review by iceanddust (commit 574da455 + this commit).

  it('partial redeem (200 PT redeemed of 1000): earnings shown with prorated cost basis', () => {
    // Bought 1000 PT for $1000, no sells, on-chain balance = 800 (200 redeemed).
    // Preview shows 810 USDG for the 800 remaining.
    // remainingFraction = 800/1000 = 0.8 → proratedNetCost = $800 → earnings = $10.
    const result = computeMaturedEarnings({
      history: [buy({ secondsBeforeExpiry: 90 * DAY, value: 1000, pt: 1000 })],
      previewAmount: toUnderlying(810, PEGGED_MARKET),
      chi: undefined,
      market: PEGGED_MARKET,
      effectiveTier: 'pegged',
      ptBalanceFloat: 800
    });
    expect(result.earnings).toBeCloseTo(10, 4);
    expect(result.currency).toBe('USDS');
    expect(result.apy).toBeDefined();
    expect(result.apy!).toBeGreaterThan(0);
  });

  it('large partial redeem (800 PT redeemed of 1000): earnings shown with prorated cost basis', () => {
    // 80% redeemed. remainingFraction = 200/1000 = 0.2 → proratedNetCost = $200
    // → preview 205 USDG → earnings = $5.
    const result = computeMaturedEarnings({
      history: [buy({ secondsBeforeExpiry: 90 * DAY, value: 1000, pt: 1000 })],
      previewAmount: toUnderlying(205, PEGGED_MARKET),
      chi: undefined,
      market: PEGGED_MARKET,
      effectiveTier: 'pegged',
      ptBalanceFloat: 200
    });
    expect(result.earnings).toBeCloseTo(5, 4);
    expect(result.currency).toBe('USDS');
    expect(result.apy).toBeDefined();
  });

  it('redeem to dust (balance ≈ 0.001 PT of 1000 originally): finite math, no NaN', () => {
    // ratio = 0.001/1000 = 1e-6 → proratedNetCost = $1000 × 1e-6 = $0.001.
    // previewAmount for 0.001 PT ≈ 0.001 USDG → finalValue ≈ 0.001.
    // earnings ≈ 0. The contract here is "math doesn't blow up at the
    // boundary"; the exact value is incidental.
    const result = computeMaturedEarnings({
      history: [buy({ secondsBeforeExpiry: 90 * DAY, value: 1000, pt: 1000 })],
      previewAmount: toUnderlying(0.001, PEGGED_MARKET),
      chi: undefined,
      market: PEGGED_MARKET,
      effectiveTier: 'pegged',
      ptBalanceFloat: 0.001
    });
    expect(result.earnings).toBeDefined();
    expect(Number.isFinite(result.earnings!)).toBe(true);
    expect(Number.isNaN(result.earnings!)).toBe(false);
    expect(result.earnings!).toBeCloseTo(0, 4);
    // APY guard: proratedNetCost > 0 so APY is defined; its value isn't the
    // assertion target — what matters is no Infinity/NaN.
    expect(Number.isFinite(result.apy!)).toBe(true);
  });

  it('excess PT on-chain (netPt < balance × 0.99): still hides (unchanged direction)', () => {
    // Bought 500 PT for $500, but on-chain balance = 1000 (someone sent 500
    // PT in). netPt = 500, balance = 1000. 500 < 1000 × 0.99 = 990 → hide.
    expect(
      computeMaturedEarnings({
        history: [buy({ secondsBeforeExpiry: 90 * DAY, value: 500, pt: 500 })],
        previewAmount: toUnderlying(1010, PEGGED_MARKET),
        chi: undefined,
        market: PEGGED_MARKET,
        effectiveTier: 'pegged',
        ptBalanceFloat: 1000
      })
    ).toEqual(EMPTY);
  });

  it('within-tolerance excess drift (0.5%): Math.min cap → no proration → un-prorated math', () => {
    // ptBought=1000, balance=1005. ratio=1.005, capped at 1 → no proration.
    // Preview 1010 → earnings = 1010 − 1000 = $10. This is the load-bearing
    // case for the Math.min(1, ratio) cap: without it, balance-slightly-above-
    // netPt would inflate the cost basis and reduce displayed earnings.
    const result = computeMaturedEarnings({
      history: [buy({ secondsBeforeExpiry: 90 * DAY, value: 1000, pt: 1000 })],
      previewAmount: toUnderlying(1010, PEGGED_MARKET),
      chi: undefined,
      market: PEGGED_MARKET,
      effectiveTier: 'pegged',
      ptBalanceFloat: 1005
    });
    expect(result.earnings).toBeCloseTo(10, 4);
  });

  it('tolerance boundary excess side (1.0% drift, balance=1010): still allowed, no proration', () => {
    // netPt=1000, balance=1010. 1000 < 1010 × 0.99 = 999.9? false → allow.
    // ratio = 1.01 → Math.min cap → 1. earnings = preview(1015) − cost(1000) = $15.
    const result = computeMaturedEarnings({
      history: [buy({ secondsBeforeExpiry: 90 * DAY, value: 1000, pt: 1000 })],
      previewAmount: toUnderlying(1015, PEGGED_MARKET),
      chi: undefined,
      market: PEGGED_MARKET,
      effectiveTier: 'pegged',
      ptBalanceFloat: 1010
    });
    expect(result.earnings).toBeCloseTo(15, 4);
  });

  it('tolerance boundary shortfall side (1.0% drift, balance=990): allowed with proration', () => {
    // netPt=1000, balance=990. ratio = 0.99 → proratedNetCost = $990.
    // Preview 1000 → earnings = 1000 − 990 = $10. The 1% gate is asymmetric:
    // shortfall always allowed, even at the boundary.
    const result = computeMaturedEarnings({
      history: [buy({ secondsBeforeExpiry: 90 * DAY, value: 1000, pt: 1000 })],
      previewAmount: toUnderlying(1000, PEGGED_MARKET),
      chi: undefined,
      market: PEGGED_MARKET,
      effectiveTier: 'pegged',
      ptBalanceFloat: 990
    });
    expect(result.earnings).toBeCloseTo(10, 4);
  });

  it('buy + sell + redeem (earnings shown, APY hidden because of the sell)', () => {
    // Bought 1000 PT for $1000, sold 200 PT for $200, then redeemed 100 PT
    // (vanishes from history; only on-chain balance drops). netPt = 800;
    // balance = 700. ratio = 700/800 = 0.875. netCostUsd = $800 → proratedNetCost
    // = $800 × 0.875 = $700. Preview for 700 PT → 710 USDG → earnings = $10.
    // APY hidden because sells.length > 0 (decision 3).
    const result = computeMaturedEarnings({
      history: [
        buy({ secondsBeforeExpiry: 90 * DAY, value: 1000, pt: 1000 }),
        sell({ secondsBeforeExpiry: 60 * DAY, value: 200, pt: 200 })
      ],
      previewAmount: toUnderlying(710, PEGGED_MARKET),
      chi: undefined,
      market: PEGGED_MARKET,
      effectiveTier: 'pegged',
      ptBalanceFloat: 700
    });
    expect(result.earnings).toBeCloseTo(10, 4);
    expect(result.currency).toBe('USDS');
    expect(result.apy).toBeUndefined();
  });
});

describe('computeMaturedEarnings — APY policy (slice 03)', () => {
  it('pure buy-and-hold (1 buy, 0 sells) keeps both earnings and APY', () => {
    // Sanity check that the no-sells branch is unchanged: APY remains defined
    // and matches the existing formula.
    const result = computeMaturedEarnings({
      history: [buy({ secondsBeforeExpiry: 90 * DAY, value: 1000, pt: 1000 })],
      previewAmount: toUnderlying(1010, PEGGED_MARKET),
      chi: undefined,
      market: PEGGED_MARKET,
      effectiveTier: 'pegged',
      ptBalanceFloat: 1000
    });
    expect(result.earnings).toBeCloseTo(10, 4);
    expect(result.apy).toBeDefined();
    expect(result.apy!).toBeGreaterThan(0);
  });

  it('1 buy + 1 sell with remaining PT: earnings shown, APY hidden', () => {
    // Bought 1000 PT for $1000, sold 200 PT for $200, still hold 800 PT.
    // netPtFromPendle = 800 == ptBalanceFloat → reconciles.
    // netCostUsd = $800; previewAmount → 820 underlying → earnings = $20.
    // Because sells.length > 0, daysHeld from earliestBuyTimestamp is no
    // longer a faithful capital-deployment window — drop APY.
    const result = computeMaturedEarnings({
      history: [
        buy({ secondsBeforeExpiry: 90 * DAY, value: 1000, pt: 1000 }),
        sell({ secondsBeforeExpiry: 60 * DAY, value: 200, pt: 200 })
      ],
      previewAmount: toUnderlying(820, PEGGED_MARKET),
      chi: undefined,
      market: PEGGED_MARKET,
      effectiveTier: 'pegged',
      ptBalanceFloat: 800
    });
    expect(result.earnings).toBeCloseTo(20, 4);
    expect(result.currency).toBe('USDS');
    expect(result.apy).toBeUndefined();
  });

  it('buy-sell-buy pattern with remaining PT: earnings shown, APY hidden', () => {
    // 600 in, 100 out, 500 in → net PT 1000; net cost $1000.
    // Reconciles (1000 == ptBalanceFloat), preview 1050 → earnings $50.
    // sells.length > 0 → APY hidden even though there's a real return.
    const result = computeMaturedEarnings({
      history: [
        buy({ secondsBeforeExpiry: 90 * DAY, value: 600, pt: 600 }),
        sell({ secondsBeforeExpiry: 60 * DAY, value: 100, pt: 100 }),
        buy({ secondsBeforeExpiry: 30 * DAY, value: 500, pt: 500 })
      ],
      previewAmount: toUnderlying(1050, PEGGED_MARKET),
      chi: undefined,
      market: PEGGED_MARKET,
      effectiveTier: 'pegged',
      ptBalanceFloat: 1000
    });
    expect(result.earnings).toBeCloseTo(50, 4);
    expect(result.currency).toBe('USDS');
    expect(result.apy).toBeUndefined();
  });
});

describe('computeMaturedEarnings — additional scenarios', () => {
  it('merges multiple buys correctly regardless of trade source (Pendle UI, tarmac, or aggregator)', () => {
    // Pendle's /v5/transactions API is filtered by (marketAddress, txOrigin) only —
    // any trade through Pendle's router shows up regardless of which frontend or
    // aggregator initiated it. Cross-frontend usage (e.g. user trades on
    // app.pendle.finance AND on tarmac with the same wallet) is the happy path,
    // not an edge case. Five buys at different timestamps confirm aggregation.
    const result = computeMaturedEarnings({
      history: [
        buy({ secondsBeforeExpiry: 100 * DAY, value: 200, pt: 200 }),
        buy({ secondsBeforeExpiry: 80 * DAY, value: 200, pt: 200 }),
        buy({ secondsBeforeExpiry: 60 * DAY, value: 200, pt: 200 }),
        buy({ secondsBeforeExpiry: 40 * DAY, value: 200, pt: 200 }),
        buy({ secondsBeforeExpiry: 20 * DAY, value: 200, pt: 200 })
      ],
      previewAmount: toUnderlying(1050, PEGGED_MARKET),
      chi: undefined,
      market: PEGGED_MARKET,
      effectiveTier: 'pegged',
      ptBalanceFloat: 1000
    });
    expect(result.earnings).toBeCloseTo(50, 4); // 1050 received − 1000 spent
    expect(result.apy).toBeDefined();
    // daysHeld derived from the earliest of the 5 buys (100 days).
  });

  it('multiple buys at different prices: cost basis aggregates by sum of values', () => {
    // 500 PT at $500 (early), 500 PT at $480 (later) — total $980 for 1000 PT.
    // Redeem preview 1010 USDG → earnings = 1010 − 980 = $30.
    const result = computeMaturedEarnings({
      history: [
        buy({ secondsBeforeExpiry: 90 * DAY, value: 500, pt: 500 }),
        buy({ secondsBeforeExpiry: 30 * DAY, value: 480, pt: 500 })
      ],
      previewAmount: toUnderlying(1010, PEGGED_MARKET),
      chi: undefined,
      market: PEGGED_MARKET,
      effectiveTier: 'pegged',
      ptBalanceFloat: 1000
    });
    expect(result.earnings).toBeCloseTo(30, 4);
  });

  it('multiple sells with PT remaining: earnings shown, APY hidden', () => {
    // Buy 1000 for $1000, sell 100 for $105, sell 100 for $108.
    // netPt = 1000 − 200 = 800 (matches balance). netCost = 1000 − 213 = $787.
    // Redeem preview 815 USDG → earnings = $28. APY hidden (sells present).
    const result = computeMaturedEarnings({
      history: [
        buy({ secondsBeforeExpiry: 120 * DAY, value: 1000, pt: 1000 }),
        sell({ secondsBeforeExpiry: 90 * DAY, value: 105, pt: 100 }),
        sell({ secondsBeforeExpiry: 60 * DAY, value: 108, pt: 100 })
      ],
      previewAmount: toUnderlying(815, PEGGED_MARKET),
      chi: undefined,
      market: PEGGED_MARKET,
      effectiveTier: 'pegged',
      ptBalanceFloat: 800
    });
    expect(result.earnings).toBeCloseTo(28, 4);
    expect(result.apy).toBeUndefined();
  });

  it('returns negative earnings when redeem yields less than net cost (card has its own > 0 guard)', () => {
    // Bought 1000 PT for $1010 (overpaid); redeem preview 1000 USDG.
    // earnings = 1000 − 1010 = −$10. Function returns the negative value;
    // PendleMaturedPositionCard separately filters via `earnings > 0` before
    // rendering. This test documents the function/card division of responsibility.
    const result = computeMaturedEarnings({
      history: [buy({ secondsBeforeExpiry: 90 * DAY, value: 1010, pt: 1000 })],
      previewAmount: toUnderlying(1000, PEGGED_MARKET),
      chi: undefined,
      market: PEGGED_MARKET,
      effectiveTier: 'pegged',
      ptBalanceFloat: 1000
    });
    expect(result.earnings).toBeLessThan(0);
    expect(result.earnings).toBeCloseTo(-10, 4);
    expect(result.currency).toBe('USDS');
  });

  it('bought at the expiry timestamp: daysHeld === 0 → APY undefined (no divide-by-zero)', () => {
    // Edge case: trade timestamp equals market.expiry. daysHeld = 0.
    // APY guard `daysHeld > 0 && proratedNetCost > 0` rejects → apy undefined.
    // Earnings still computed honestly.
    const result = computeMaturedEarnings({
      history: [buy({ secondsBeforeExpiry: 0, value: 1000, pt: 1000 })],
      previewAmount: toUnderlying(1010, PEGGED_MARKET),
      chi: undefined,
      market: PEGGED_MARKET,
      effectiveTier: 'pegged',
      ptBalanceFloat: 1000
    });
    expect(result.earnings).toBeCloseTo(10, 4);
    expect(result.apy).toBeUndefined();
  });

  it('very short hold (1 day): APY math produces a finite annualized rate', () => {
    // Bought 1 day before maturity for $1000, redeem 1001 USDG → earnings $1.
    // APY = (1001/1000)^365 − 1 ≈ 0.44 (44%). Large but finite.
    const result = computeMaturedEarnings({
      history: [buy({ secondsBeforeExpiry: 1 * DAY, value: 1000, pt: 1000 })],
      previewAmount: toUnderlying(1001, PEGGED_MARKET),
      chi: undefined,
      market: PEGGED_MARKET,
      effectiveTier: 'pegged',
      ptBalanceFloat: 1000
    });
    expect(result.earnings).toBeCloseTo(1, 4);
    expect(result.apy).toBeDefined();
    expect(Number.isFinite(result.apy!)).toBe(true);
  });

  it('just past the excess tolerance boundary (balance=1011, netPt=1000): hides', () => {
    // Companion to the redeem-handling block's 1010 "still allowed" boundary test.
    // 1011/1000 → 1.1% excess drift → `netPt < balance × 0.99` is true → hide.
    expect(
      computeMaturedEarnings({
        history: [buy({ secondsBeforeExpiry: 90 * DAY, value: 1000, pt: 1000 })],
        previewAmount: toUnderlying(1010, PEGGED_MARKET),
        chi: undefined,
        market: PEGGED_MARKET,
        effectiveTier: 'pegged',
        ptBalanceFloat: 1011
      })
    ).toEqual(EMPTY);
  });

  it('sUSDS path with chi=1.5: math remains correct at extreme conversion rates', () => {
    // sUSDS rate has grown 50% since the user bought (very generous).
    // receiveTokens × 1.5 = 1500 USDS. Cost $1000 → earnings $500.
    const CHI_1_5 = 1_500_000_000_000_000_000n;
    const result = computeMaturedEarnings({
      history: [buy({ secondsBeforeExpiry: 365 * DAY, value: 1000, pt: 1000, market: SUSDS_MARKET })],
      previewAmount: toUnderlying(1000, SUSDS_MARKET),
      chi: CHI_1_5,
      market: SUSDS_MARKET,
      effectiveTier: 'sUSDS',
      ptBalanceFloat: 1000
    });
    expect(result.earnings).toBeCloseTo(500, 4);
    expect(result.currency).toBe('USDS');
  });

  it('history order does not affect earliestBuyTimestamp or the final result', () => {
    // Math.min over timestamps and reduce-sum over values are both order-independent.
    // Same fixtures in reverse order should produce identical output.
    const earliest = buy({ secondsBeforeExpiry: 100 * DAY, value: 500, pt: 500 });
    const latest = buy({ secondsBeforeExpiry: 50 * DAY, value: 500, pt: 500 });
    const ordered = computeMaturedEarnings({
      history: [earliest, latest],
      previewAmount: toUnderlying(1010, PEGGED_MARKET),
      chi: undefined,
      market: PEGGED_MARKET,
      effectiveTier: 'pegged',
      ptBalanceFloat: 1000
    });
    const reversed = computeMaturedEarnings({
      history: [latest, earliest],
      previewAmount: toUnderlying(1010, PEGGED_MARKET),
      chi: undefined,
      market: PEGGED_MARKET,
      effectiveTier: 'pegged',
      ptBalanceFloat: 1000
    });
    expect(reversed).toEqual(ordered);
  });

  it('notional present but without `pt` key: treated as 0 PT (safe fallback)', () => {
    // API returns notional with other tokens (e.g. `sy`) but no `pt` field.
    // `t.notional?.pt ?? 0` → 0. netPt = 0 vs balance = 1000 → reconciliation
    // gate fails (excess direction), line hides. Companion to the existing
    // "notional missing entirely" test in the reconciliation block.
    expect(
      computeMaturedEarnings({
        history: [
          buy({
            secondsBeforeExpiry: 90 * DAY,
            value: 1000,
            notional: { sy: 1000 } // pt key absent
          })
        ],
        previewAmount: toUnderlying(1010, PEGGED_MARKET),
        chi: undefined,
        market: PEGGED_MARKET,
        effectiveTier: 'pegged',
        ptBalanceFloat: 1000
      })
    ).toEqual(EMPTY);
  });
});
