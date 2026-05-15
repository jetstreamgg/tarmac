import { describe, expect, it } from 'vitest';
import { computeMaturedEarnings } from './computeMaturedEarnings';
import { PendleHistoryAction } from './constants';
import type { PendleHistoryRow, PendleMarketConfig } from './pendle';

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
  action: PendleHistoryAction.BUY_PT | PendleHistoryAction.SELL_PT,
  opts: {
    secondsBeforeExpiry: number;
    value: number;
    pt?: number;
    market?: PendleMarketConfig;
  }
): PendleHistoryRow {
  return {
    id: nextId(),
    txHash: '0xabc',
    timestamp: new Date((EXPIRY - opts.secondsBeforeExpiry) * 1000).toISOString(),
    action,
    ptAmount: opts.pt ?? opts.value,
    valueUsd: opts.value
  };
}

const buy = (opts: Parameters<typeof makeTrade>[1]) => makeTrade(PendleHistoryAction.BUY_PT, opts);
const sell = (opts: Parameters<typeof makeTrade>[1]) => makeTrade(PendleHistoryAction.SELL_PT, opts);

// REDEEM_PY rows from Pendle's /v1/pnl/transactions feed. Per the normalizer
// in usePendleMarketHistory, ptAmount carries the underlying received (1 PT =
// 1 underlying at maturity) and valueUsd is set to 0 (Pendle doesn't report
// a USD value for redeems — computeMaturedEarnings derives the realized value
// from ptAmount + the market's chi conversion).
function redeem(opts: { secondsBeforeExpiry: number; pt: number }): PendleHistoryRow {
  return {
    id: nextId(),
    txHash: `0xredeem-${_idCounter}`,
    timestamp: new Date((EXPIRY - opts.secondsBeforeExpiry) * 1000).toISOString(),
    action: PendleHistoryAction.REDEEM_PY,
    ptAmount: opts.pt,
    valueUsd: 0
  };
}

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

  it('reconciles shortfall when REDEEM_PY events explain it (no proration needed)', () => {
    // Slice 03 changed the contract: shortfall must be EXPLAINED by REDEEM_PY
    // events from Pendle's /v1/pnl/transactions feed. The asymmetric proration
    // heuristic (review-fix slice 02) is replaced with symmetric reconciliation
    // because the v1 feed gives us actual redeem rows. Bought 100 PT for $100,
    // redeemed 20 PT (now indexed), balance = 80. netPt = 100 − 20 = 80 →
    // exact reconcile. realized = 20 × $1 = $20. finalValue (preview 82) = $82.
    // earnings = finalValue + realized − netCost = 82 + 20 − 100 = $2.
    const result = computeMaturedEarnings({
      history: [
        buy({ secondsBeforeExpiry: 90 * DAY, value: 100, pt: 100 }),
        redeem({ secondsBeforeExpiry: 0, pt: 20 })
      ],
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

  it('hides earnings when ptAmount is zero on some BUY rows (upstream fallback for missing notional)', () => {
    // Two buys totaling 1000 PT in cost basis terms, but Pendle's API omitted
    // notional on one row, so the normalizer set ptAmount=0 for it. The zeroed
    // entry contributes 0 to the PT sum → netPtFromPendle = 500 vs
    // ptBalanceFloat = 1000 → 50% drift → empty. Asserts the conservative
    // failure mode when upstream API data is malformed.
    expect(
      computeMaturedEarnings({
        history: [
          buy({ secondsBeforeExpiry: 90 * DAY, value: 500, pt: 500 }),
          buy({ secondsBeforeExpiry: 60 * DAY, value: 500, pt: 0 })
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

describe('computeMaturedEarnings — redeem handling with v1 PnL feed (slice 04)', () => {
  // Slice 04 (this work): Pendle's /v1/pnl/transactions feed surfaces
  // REDEEM_PY rows that the v5 /transactions feed never did. With real redeem
  // data, the reconciliation gate is now SYMMETRIC: drift in either direction
  // beyond 1% hides the line. There's no proration heuristic — earnings are
  // computed directly from realized (redeems) + unrealized (remaining preview)
  // minus net cost. Slice-02's asymmetric gate + Math.min(1, ratio) cap are
  // both retired. See computeMaturedEarnings.ts header for the full rationale.

  it('partial redeem (200 PT of 1000) explained by a REDEEM_PY event: earnings shown without proration', () => {
    // Bought 1000 PT for $1000, redeemed 200 PT (now indexed via /v1/pnl).
    // netPt = 1000 − 0 − 200 = 800. Balance 800 → exact reconcile.
    // Preview 810 USDG for the 800 remaining + 200 USDG realized from redeem.
    // earnings = finalValue + realized − netCost = 810 + 200 − 1000 = $10.
    const result = computeMaturedEarnings({
      history: [
        buy({ secondsBeforeExpiry: 90 * DAY, value: 1000, pt: 1000 }),
        redeem({ secondsBeforeExpiry: 0, pt: 200 })
      ],
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

  it('large partial redeem (800 PT of 1000) explained by REDEEM_PY: earnings shown', () => {
    // 80% redeemed. netPt = 1000 − 0 − 800 = 200. Balance 200 → reconcile.
    // realized = 800 × $1 = $800. finalValue = preview 205 USDG = $205.
    // earnings = 205 + 800 − 1000 = $5.
    const result = computeMaturedEarnings({
      history: [
        buy({ secondsBeforeExpiry: 90 * DAY, value: 1000, pt: 1000 }),
        redeem({ secondsBeforeExpiry: 0, pt: 800 })
      ],
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

  it('redeem to dust (REDEEM_PY for 999.999 of 1000): finite math, no NaN', () => {
    // netPt = 1000 − 0 − 999.999 = 0.001. Balance 0.001 → reconcile.
    // realized = 999.999 × $1 = $999.999. finalValue ≈ $0.001.
    // earnings ≈ 0.001 + 999.999 − 1000 = 0. Math doesn't blow up at the
    // boundary; the exact value is incidental.
    const result = computeMaturedEarnings({
      history: [
        buy({ secondsBeforeExpiry: 90 * DAY, value: 1000, pt: 1000 }),
        redeem({ secondsBeforeExpiry: 0, pt: 999.999 })
      ],
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
    // APY guard: netCost > 0 so APY is defined; what matters is no Infinity/NaN.
    expect(Number.isFinite(result.apy!)).toBe(true);
  });

  it('excess PT on-chain (balance > netPt + 1%): hides regardless of redeem events', () => {
    // Bought 500 PT for $500, no redeems, but on-chain balance = 1000 (gifted
    // PT). netPt = 500, balance = 1000. |500−1000|/500 = 100% drift → hide.
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

  it('within-tolerance excess drift (0.5%, no redeem): allows', () => {
    // ptBought=1000, balance=1005, no redeems. |1000−1005|/1000 = 0.5% < 1% → allow.
    // earnings = preview(1010) + 0 − 1000 = $10.
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

  it('tolerance boundary excess side (1.0% drift, balance=1010): still allowed', () => {
    // netPt=1000, balance=1010. |drift|/netPt = 1.0% → at the boundary.
    // Symmetric gate uses > 1% → 1.0% exact is allowed.
    // earnings = preview(1015) − cost(1000) = $15.
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

  it('tolerance boundary shortfall side (1.0% drift, balance=990, no redeem): allowed', () => {
    // netPt=1000, balance=990. |drift|/netPt = 1.0% → boundary, allowed.
    // No redeems → no realized component. earnings = finalValue + 0 − netCost.
    // Preview 1000 → earnings = 1000 + 0 − 1000 = $0. (Within-tolerance drift
    // is absorbed as dust; we don't speculate about the missing 10 PT.)
    const result = computeMaturedEarnings({
      history: [buy({ secondsBeforeExpiry: 90 * DAY, value: 1000, pt: 1000 })],
      previewAmount: toUnderlying(1000, PEGGED_MARKET),
      chi: undefined,
      market: PEGGED_MARKET,
      effectiveTier: 'pegged',
      ptBalanceFloat: 990
    });
    expect(result.earnings).toBeCloseTo(0, 4);
  });

  it('buy + sell + redeem with REDEEM_PY event: earnings shown, APY hidden because of the sell', () => {
    // Bought 1000 PT for $1000, sold 200 PT for $200, redeemed 100 PT.
    // netPt = 1000 − 200 − 100 = 700. Balance 700 → reconcile.
    // netCostUsd = $1000 − $200 = $800. realized from redeem = 100 × $1 = $100.
    // Preview for 700 PT → 710 USDG.
    // earnings = 710 + 100 − 800 = $10. APY hidden (sells.length > 0).
    const result = computeMaturedEarnings({
      history: [
        buy({ secondsBeforeExpiry: 90 * DAY, value: 1000, pt: 1000 }),
        sell({ secondsBeforeExpiry: 60 * DAY, value: 200, pt: 200 }),
        redeem({ secondsBeforeExpiry: 0, pt: 100 })
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

  it('unexplained shortfall (balance < netPt − 1%, NO redeem events): hides (transfer-out)', () => {
    // Slice 03 behavior change: without REDEEM_PY rows to explain it, a
    // shortfall is now treated as a transfer-out (unknown cost basis) and
    // hidden. Slice-02 used to interpret this as a redeem and prorate cost
    // basis — that heuristic is removed now that the v1 feed gives us real
    // redeem events. Documents the new strictness.
    expect(
      computeMaturedEarnings({
        history: [buy({ secondsBeforeExpiry: 90 * DAY, value: 1000, pt: 1000 })],
        previewAmount: toUnderlying(810, PEGGED_MARKET),
        chi: undefined,
        market: PEGGED_MARKET,
        effectiveTier: 'pegged',
        ptBalanceFloat: 800
      })
    ).toEqual(EMPTY);
  });

  it('redeem accounting at discount-bought price: realized + unrealized split is correct', () => {
    // Bought 1000 PT at $0.95/PT (paid $950 total) for a 5% discount.
    // Redeemed 200 PT (face value: $200 received). Hold 800 PT.
    // Preview 810 USDG for the remaining 800.
    //   netPt = 1000 − 0 − 200 = 800 → reconcile.
    //   realized = 200 × $1 = $200.
    //   earnings = 810 + 200 − 950 = $60.
    // Old slice-02 proration would have given $50 (proratedCost = $950 × 0.8 =
    // $760, earnings = $810 − $760 = $50) — UNDERSTATES by missing the
    // realized gain on the redeemed portion. This is the headline improvement
    // of slice 03 over slice 02.
    const result = computeMaturedEarnings({
      history: [
        buy({ secondsBeforeExpiry: 90 * DAY, value: 950, pt: 1000 }),
        redeem({ secondsBeforeExpiry: 0, pt: 200 })
      ],
      previewAmount: toUnderlying(810, PEGGED_MARKET),
      chi: undefined,
      market: PEGGED_MARKET,
      effectiveTier: 'pegged',
      ptBalanceFloat: 800
    });
    expect(result.earnings).toBeCloseTo(60, 4);
    expect(result.currency).toBe('USDS');
    expect(result.apy).toBeDefined();
  });

  it('multiple redeems sum to total redeemed PT', () => {
    // Three separate redeem rows totaling 300 PT. netPt = 1000 − 300 = 700.
    // Balance 700 → reconcile. realized = 300 × $1 = $300.
    // earnings = preview(710) + 300 − 1000 = $10.
    const result = computeMaturedEarnings({
      history: [
        buy({ secondsBeforeExpiry: 90 * DAY, value: 1000, pt: 1000 }),
        redeem({ secondsBeforeExpiry: 30 * DAY, pt: 100 }),
        redeem({ secondsBeforeExpiry: 15 * DAY, pt: 100 }),
        redeem({ secondsBeforeExpiry: 0, pt: 100 })
      ],
      previewAmount: toUnderlying(710, PEGGED_MARKET),
      chi: undefined,
      market: PEGGED_MARKET,
      effectiveTier: 'pegged',
      ptBalanceFloat: 700
    });
    expect(result.earnings).toBeCloseTo(10, 4);
  });

  it('sUSDS market: chi applies to realized-from-redeem value (current chi, not historical)', () => {
    // Bought 1000 PT-sUSDS for $1000 USD. Redeemed 200 PT → user received 200
    // sUSDS. Current chi = 1.05 → 200 sUSDS now displays as 210 USDS.
    // Hold 800 PT → preview 800 sUSDS → 840 USDS at current chi.
    //   netPt = 1000 − 200 = 800 → reconcile.
    //   realizedFromRedeem = 200 × 1.05 = $210 USDS.
    //   finalValue = 800 × 1.05 = $840 USDS.
    //   earnings = 840 + 210 − 1000 = $50.
    // Same chi conversion applied to both realized and unrealized — consistent
    // with how finalValue treats preview (current chi, not historical).
    const result = computeMaturedEarnings({
      history: [
        buy({ secondsBeforeExpiry: 90 * DAY, value: 1000, pt: 1000, market: SUSDS_MARKET }),
        redeem({ secondsBeforeExpiry: 0, pt: 200 })
      ],
      previewAmount: toUnderlying(800, SUSDS_MARKET),
      chi: CHI_1_05,
      market: SUSDS_MARKET,
      effectiveTier: 'sUSDS',
      ptBalanceFloat: 800
    });
    expect(result.earnings).toBeCloseTo(50, 4);
    expect(result.currency).toBe('USDS');
  });

  it('full redeem (balance=0 after redeeming all PT): hides via ptBalanceFloat<=0 gate', () => {
    // User redeemed every PT they bought. balance = 0 → early return EMPTY.
    // Even though realized earnings could be computed, the card needs a
    // remaining position to anchor the display. Documents the gate.
    expect(
      computeMaturedEarnings({
        history: [
          buy({ secondsBeforeExpiry: 90 * DAY, value: 1000, pt: 1000 }),
          redeem({ secondsBeforeExpiry: 0, pt: 1000 })
        ],
        previewAmount: 0n,
        chi: undefined,
        market: PEGGED_MARKET,
        effectiveTier: 'pegged',
        ptBalanceFloat: 0
      })
    ).toEqual(EMPTY);
  });

  it('redeem with 0 ptAmount (degenerate v1 row): treated as 0 PT, no balance impact', () => {
    // Defensive: if the v1 normalizer hands us a REDEEM_PY row with ptAmount=0
    // (e.g. txValueAsset missing from the wire), it should sum to 0 in netPt
    // — same safe-fallback shape as ptAmount=0 on BUY_PT rows. Bought 1000 PT,
    // bogus redeem row, balance still 1000. Reconciles cleanly; earnings unchanged.
    const result = computeMaturedEarnings({
      history: [
        buy({ secondsBeforeExpiry: 90 * DAY, value: 1000, pt: 1000 }),
        redeem({ secondsBeforeExpiry: 0, pt: 0 })
      ],
      previewAmount: toUnderlying(1010, PEGGED_MARKET),
      chi: undefined,
      market: PEGGED_MARKET,
      effectiveTier: 'pegged',
      ptBalanceFloat: 1000
    });
    expect(result.earnings).toBeCloseTo(10, 4);
  });

  it('buy + redeem + transfer-out: balance < (netPt − redeemed), unexplained → hides', () => {
    // Bought 1000 PT, redeemed 200 PT (real REDEEM_PY row), then transferred
    // out 100 more PT (no redeem row). netPt = 1000 − 200 = 800. Balance 700.
    // |800 − 700| / 800 = 12.5% drift → hide. The redeem event explains part
    // of the gap; the unexplained 100 PT triggers the gate.
    expect(
      computeMaturedEarnings({
        history: [
          buy({ secondsBeforeExpiry: 90 * DAY, value: 1000, pt: 1000 }),
          redeem({ secondsBeforeExpiry: 0, pt: 200 })
        ],
        previewAmount: toUnderlying(710, PEGGED_MARKET),
        chi: undefined,
        market: PEGGED_MARKET,
        effectiveTier: 'pegged',
        ptBalanceFloat: 700
      })
    ).toEqual(EMPTY);
  });

  it('heterogeneous buy prices + partial redeem: averaged costPerPt drives APY ratio', () => {
    // 500 PT at $475 (early, $0.95/PT) + 500 PT at $510 (later, $1.02/PT) =
    // 1000 PT for $985 total. costPerPt = 985/1000 = 0.985.
    // Redeemed 200 PT (face value $200), balance 800.
    //   netPt = 800 → reconciles. realized = 200 × $1 = $200.
    //   finalValue = preview(810) = $810.
    //   earnings = 810 + 200 − 985 = $25.
    //   costOfRemaining = 0.985 × 800 = $788. APY = (810/788)^(365/90) − 1.
    // Validates that the average-cost-per-PT model handles non-uniform entry
    // prices without distorting the realized/unrealized split.
    const result = computeMaturedEarnings({
      history: [
        buy({ secondsBeforeExpiry: 90 * DAY, value: 475, pt: 500 }),
        buy({ secondsBeforeExpiry: 30 * DAY, value: 510, pt: 500 }),
        redeem({ secondsBeforeExpiry: 0, pt: 200 })
      ],
      previewAmount: toUnderlying(810, PEGGED_MARKET),
      chi: undefined,
      market: PEGGED_MARKET,
      effectiveTier: 'pegged',
      ptBalanceFloat: 800
    });
    expect(result.earnings).toBeCloseTo(25, 4);
    expect(result.apy).toBeDefined();
    expect(result.apy!).toBeGreaterThan(0);
    // Sanity: APY should be higher than the at-cost equivalent (which would be
    // (810/800)^(365/100) − 1 ≈ 4.6%). Discount entry → higher implied yield.
    expect(result.apy!).toBeGreaterThan(0.04);
  });

  it('pre-maturity redeem (PT+YT pair, secondsBeforeExpiry > 0): handled the same as post-maturity', () => {
    // Pendle allows redeemPy(PT+YT) before maturity at face value when the
    // user holds matching amounts of both. From this function's perspective,
    // the redeem is just a PT exit at 1:1 underlying — timing relative to
    // expiry doesn't change the math. Redeem 60 days before expiry, otherwise
    // identical to the "partial redeem (200 of 1000)" test → same earnings.
    const result = computeMaturedEarnings({
      history: [
        buy({ secondsBeforeExpiry: 90 * DAY, value: 1000, pt: 1000 }),
        redeem({ secondsBeforeExpiry: 60 * DAY, pt: 200 })
      ],
      previewAmount: toUnderlying(810, PEGGED_MARKET),
      chi: undefined,
      market: PEGGED_MARKET,
      effectiveTier: 'pegged',
      ptBalanceFloat: 800
    });
    expect(result.earnings).toBeCloseTo(10, 4);
    expect(result.apy).toBeDefined();
  });

  it('history with only REDEEM_PY rows (no BUY_PT): netCost = 0 → hides', () => {
    // Defensive: if the v5 feed paginated out our buys but the v1 feed still
    // surfaces a redeem, we'd have a netCost of 0 and no honest math.
    // Function early-returns via the `netCostUsd <= 0` guard.
    expect(
      computeMaturedEarnings({
        history: [redeem({ secondsBeforeExpiry: 0, pt: 200 })],
        previewAmount: toUnderlying(810, PEGGED_MARKET),
        chi: undefined,
        market: PEGGED_MARKET,
        effectiveTier: 'pegged',
        ptBalanceFloat: 800
      })
    ).toEqual(EMPTY);
  });

  it('buy + redeem (no sells): APY remains visible (redeems are not market exits)', () => {
    // Decision 3 explicitly states REDEEM_PY rows do not trigger the APY-hide
    // policy that SELL_PT rows do. A redeem closes a portion of the position
    // at maturity face value — the natural end-of-life, not a market-timing
    // exit. So buy + redeem keeps APY; buy + sell + redeem hides it.
    const result = computeMaturedEarnings({
      history: [
        buy({ secondsBeforeExpiry: 180 * DAY, value: 1000, pt: 1000 }),
        redeem({ secondsBeforeExpiry: 0, pt: 500 })
      ],
      previewAmount: toUnderlying(510, PEGGED_MARKET),
      chi: undefined,
      market: PEGGED_MARKET,
      effectiveTier: 'pegged',
      ptBalanceFloat: 500
    });
    expect(result.earnings).toBeCloseTo(10, 4);
    expect(result.apy).toBeDefined();
    expect(result.apy!).toBeGreaterThan(0);
  });

  it('redeem timestamp does not affect daysHeld (APY uses earliest BUY)', () => {
    // daysHeld is anchored to the earliest BUY_PT timestamp; redeem events at
    // any time within or past the maturity window must not shift it. Two
    // identical positions, one with an old redeem and one with a fresh redeem,
    // should report the same APY.
    const earlyRedeem = computeMaturedEarnings({
      history: [
        buy({ secondsBeforeExpiry: 180 * DAY, value: 1000, pt: 1000 }),
        redeem({ secondsBeforeExpiry: 90 * DAY, pt: 200 })
      ],
      previewAmount: toUnderlying(810, PEGGED_MARKET),
      chi: undefined,
      market: PEGGED_MARKET,
      effectiveTier: 'pegged',
      ptBalanceFloat: 800
    });
    const lateRedeem = computeMaturedEarnings({
      history: [
        buy({ secondsBeforeExpiry: 180 * DAY, value: 1000, pt: 1000 }),
        redeem({ secondsBeforeExpiry: 0, pt: 200 })
      ],
      previewAmount: toUnderlying(810, PEGGED_MARKET),
      chi: undefined,
      market: PEGGED_MARKET,
      effectiveTier: 'pegged',
      ptBalanceFloat: 800
    });
    expect(earlyRedeem.apy).toBeCloseTo(lateRedeem.apy!, 6);
    expect(earlyRedeem.earnings).toBeCloseTo(lateRedeem.earnings!, 6);
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

  it('very short hold (exactly 1 day): APY math produces a finite annualized rate', () => {
    // Bought 1 day before maturity for $1000, redeem 1001 USDG → earnings $1.
    // APY = (1001/1000)^365 − 1 ≈ 0.44 (44%). Large but finite. 1 day is the
    // boundary at which APY is still allowed by the sub-day guard.
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

  it('sub-day hold (0.25 days, bought 6 hours before expiry): APY undefined, no Infinity', () => {
    // Surfaced by PR #1546 QA: a reviewer's PT-sENA position was bought a few
    // hours before maturity. Math.pow(ratio, 365/0.25) = Math.pow(ratio, 1460)
    // overflows to Infinity for any ratio > ~1.005, which the UI then renders
    // as "Infinity% APY" — broken display. Sub-day annualization is also
    // semantically meaningless. Hide APY; earnings still computed normally.
    const result = computeMaturedEarnings({
      history: [buy({ secondsBeforeExpiry: 0.25 * DAY, value: 1000, pt: 1000 })],
      previewAmount: toUnderlying(1001, PEGGED_MARKET),
      chi: undefined,
      market: PEGGED_MARKET,
      effectiveTier: 'pegged',
      ptBalanceFloat: 1000
    });
    expect(result.earnings).toBeCloseTo(1, 4);
    expect(result.apy).toBeUndefined();
  });

  it('sub-day hold with a large ratio (Infinity overflow case): APY undefined', () => {
    // Stress test the overflow path directly. If we had not guarded against
    // sub-day holds, Math.pow(15/7, 1460) would overflow to Infinity. The
    // ratio here mirrors what the PR review surfaced (chi-inflated finalValue
    // / cost basis ≈ 2). Earnings still computed; APY hidden.
    const result = computeMaturedEarnings({
      history: [buy({ secondsBeforeExpiry: 0.25 * DAY, value: 7, pt: 7 })],
      previewAmount: toUnderlying(15, PEGGED_MARKET),
      chi: undefined,
      market: PEGGED_MARKET,
      effectiveTier: 'pegged',
      ptBalanceFloat: 7
    });
    expect(result.earnings).toBeCloseTo(8, 4);
    expect(result.apy).toBeUndefined();
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

  it('ptAmount of 0 on a buy row: treated as 0 PT (safe fallback)', () => {
    // The upstream normalizer hands us ptAmount=0 when Pendle's notional lacks
    // a `pt` key. netPt = 0 vs balance = 1000 → reconciliation gate fails
    // (excess direction), line hides. Companion to the existing zeroed-on-some-
    // trades test in the reconciliation block.
    expect(
      computeMaturedEarnings({
        history: [
          buy({
            secondsBeforeExpiry: 90 * DAY,
            value: 1000,
            pt: 0
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
