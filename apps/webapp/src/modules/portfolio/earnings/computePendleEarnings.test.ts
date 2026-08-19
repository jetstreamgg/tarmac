import { describe, expect, it } from 'vitest';
import type { PendleMarketConfig } from '../../../hooks/pendle/pendle';
import type {
  PendleDashboardChainPositionsRaw,
  PendleDashboardMarketPositionRaw,
  PendlePnlGainedPositionRaw,
  PendlePnlTransactionRaw
} from '../../../hooks/pendle/pendle';
import { computePendleEarnings } from './computePendleEarnings';
import dashboardFixture from './pendleDashboardPositions.golden.fixtures.json';
import gainedFixture from './pendlePnlGained.golden.fixtures.json';
import transactionsFixture from './pendlePnlTransactions.golden.fixtures.json';

// Reference wallet 0x0401… golden numbers (ticket dossier + frozen fixtures,
// captured 2026-08-19). The target market is PT-sUSDS 0x9c56…, fully closed.
const TARGET_MARKET = '0x9c560ebaf78e596cbcc27411d633a74d628dd7dc';

// pnl.netGain.usd for the target market straight from the gained fixture
// (dossier: 916.82).
const GOLDEN_NET_GAIN_USD = 916.817210565856;

// profit.usd of the target market's four transaction rows, straight from the
// transactions fixture. Only the two August rows are in the monthly window.
const AUG_REDEEM_REWARDS_PROFIT = 97.12441458958958; // 2026-08-03 redeemMarketRewards
const AUG_REMOVE_LIQUIDITY_PROFIT = 538.2702852105817; // 2026-08-03 removeLiquiditySingleToken
const JUNE_ADD_LIQUIDITY_PROFIT = 259.65801053809724; // 2026-06-09 addLiquiditySinglePt
const JUNE_BUY_PT_PROFIT = 0; // 2026-06-03 buyPt

// Dossier: Aug Σ profit = 635.39, lifetime Σ profit = 895.05 (never mixed with netGain).
const GOLDEN_AUG_PROFIT_USD = AUG_REDEEM_REWARDS_PROFIT + AUG_REMOVE_LIQUIDITY_PROFIT;
const GOLDEN_LIFETIME_PROFIT_USD =
  AUG_REDEEM_REWARDS_PROFIT + AUG_REMOVE_LIQUIDITY_PROFIT + JUNE_ADD_LIQUIDITY_PROFIT + JUNE_BUY_PT_PROFIT;

// August 2026 month-to-date window at fixture-capture time.
const AUG_WINDOW = { startSec: Date.UTC(2026, 7, 1) / 1000, endSec: Date.UTC(2026, 7, 19, 12) / 1000 };

const goldenGained = gainedFixture.positions as PendlePnlGainedPositionRaw[];
const goldenDashboard = dashboardFixture.positions as unknown as PendleDashboardChainPositionsRaw[];
const goldenRows = transactionsFixture.results as unknown as PendlePnlTransactionRaw[];

// ---------------------------------------------------------------------------
// Synthetic builders
// ---------------------------------------------------------------------------

const SYNTH_MARKET = '0xaaaa000000000000000000000000000000000001';

function market(overrides: Partial<PendleMarketConfig> = {}): PendleMarketConfig {
  return {
    name: 'Fixed Yield',
    slug: 'pt-test',
    marketAddress: SYNTH_MARKET as `0x${string}`,
    ptToken: '0xaaaa000000000000000000000000000000000002',
    ytToken: '0xaaaa000000000000000000000000000000000003',
    syToken: '0xaaaa000000000000000000000000000000000004',
    underlyingToken: '0xaaaa000000000000000000000000000000000005',
    underlyingSymbol: 'sUSDS',
    underlyingDecimals: 18,
    expiry: 1795651200,
    ...overrides
  };
}

function gained(overrides: Partial<PendlePnlGainedPositionRaw> = {}): PendlePnlGainedPositionRaw {
  return {
    market: SYNTH_MARKET,
    chainId: 1,
    pnl: {
      netGain: { usd: 0, asset: 0, eth: 0 },
      totalSpent: { usd: 0, asset: 0, eth: 0 }
    },
    ptBalance: 0,
    ytBalance: 0,
    lpBalance: 0,
    ...overrides
  };
}

function dashboardPosition(
  overrides: Partial<PendleDashboardMarketPositionRaw> = {}
): PendleDashboardMarketPositionRaw {
  return {
    marketId: `1-${SYNTH_MARKET}`,
    pt: { valuation: 0, balance: '0' },
    yt: { valuation: 0, balance: '0' },
    lp: { valuation: 0, balance: '0' },
    ...overrides
  };
}

function dashboardChain(
  positions: PendleDashboardMarketPositionRaw[],
  { chainId = 1, open = false }: { chainId?: number; open?: boolean } = {}
): PendleDashboardChainPositionsRaw {
  return {
    chainId,
    openPositions: open ? positions : [],
    closedPositions: open ? [] : positions
  };
}

function row(overrides: Partial<PendlePnlTransactionRaw> = {}): PendlePnlTransactionRaw {
  return {
    chainId: 1,
    market: SYNTH_MARKET,
    timestamp: '2026-08-10T00:00:00.000Z',
    action: 'removeLiquiditySingleToken',
    txHash: '0xabc',
    txValueAsset: 100,
    assetUsd: 1,
    effectivePtExchangeRate: 1,
    profit: { usd: 10, asset: 10, eth: 0 },
    ...overrides
  } as PendlePnlTransactionRaw;
}

const SYNTH_MARKETS = [market()];

function compute(overrides: Partial<Parameters<typeof computePendleEarnings>[0]> = {}) {
  return computePendleEarnings({
    gainedPositions: [],
    dashboardPositions: [],
    pnlRows: [],
    window: AUG_WINDOW,
    markets: SYNTH_MARKETS,
    ...overrides
  });
}

// ---------------------------------------------------------------------------
// Golden tests — frozen reference-wallet fixtures are the ground truth
// ---------------------------------------------------------------------------

describe('computePendleEarnings golden (reference wallet fixtures)', () => {
  const result = computePendleEarnings({
    gainedPositions: goldenGained,
    dashboardPositions: goldenDashboard,
    pnlRows: goldenRows,
    window: AUG_WINDOW
    // markets omitted → real PENDLE_MARKETS config, pinning the wiring
  });

  it('fixture sanity: the raw data matches the dossier numbers and landmines', () => {
    // Exactly one gained position for the target market, on mainnet, dossier netGain.
    const targets = goldenGained.filter(p => p.market === TARGET_MARKET);
    expect(targets).toHaveLength(1);
    expect(targets[0].chainId).toBe(1);
    expect(targets[0].pnl.netGain.usd).toBe(GOLDEN_NET_GAIN_USD);
    expect(targets[0].pnl.totalSpent.usd).toBe(0);

    // Landmine: the gained endpoint ignores chainId — foreign chains are present.
    expect(goldenGained.some(p => p.chainId !== 1)).toBe(true);
    // Landmine: negative markets exist, including one on mainnet.
    expect(goldenGained.some(p => p.chainId === 1 && (p.pnl.netGain.usd ?? 0) < 0)).toBe(true);

    // The four target-market transaction rows sum to the dossier lifetime profit.
    const targetRows = goldenRows.filter(r => r.market === TARGET_MARKET);
    expect(targetRows).toHaveLength(4);
    const lifetime = targetRows.reduce((sum, r) => sum + (r.profit?.usd ?? NaN), 0);
    expect(lifetime).toBe(GOLDEN_LIFETIME_PROFIT_USD);
    expect(lifetime).toBeCloseTo(895.05, 2);

    // The August profit comes exclusively from actions the history view drops
    // (redeemMarketRewards / removeLiquiditySingleToken) — the reason monthly
    // must be computed from raw rows, not normalized history rows.
    const augRows = targetRows.filter(r => Date.parse(r.timestamp) / 1000 >= AUG_WINDOW.startSec);
    expect(augRows.map(r => r.action).sort()).toEqual(['redeemMarketRewards', 'removeLiquiditySingleToken']);
  });

  it('total earned = netGain of the target market only (dossier 916.82)', () => {
    expect(result.totalEarned).toEqual({ status: 'ok', value: { usd: GOLDEN_NET_GAIN_USD } });
    expect(GOLDEN_NET_GAIN_USD).toBeCloseTo(916.82, 2);
  });

  it('split: mark-to-market collapses to realized for a fully closed position', () => {
    // Dashboard valuations and totalSpent are all 0 → MTM = 0 − 0 + realized.
    expect(result.pendleSplit).toEqual({
      realizedUsd: GOLDEN_NET_GAIN_USD,
      markToMarketUsd: GOLDEN_NET_GAIN_USD
    });
  });

  it('earned this month = Σ profit of the August rows (dossier 635.39), June excluded', () => {
    expect(result.earnedThisMonth).toEqual({ status: 'ok', value: { usd: GOLDEN_AUG_PROFIT_USD } });
    expect(GOLDEN_AUG_PROFIT_USD).toBeCloseTo(635.39, 2);
    // netGain and Σ profit are separate external figures — never mixed.
    expect(GOLDEN_AUG_PROFIT_USD).not.toBe(GOLDEN_LIFETIME_PROFIT_USD);
    expect(GOLDEN_NET_GAIN_USD).not.toBe(GOLDEN_LIFETIME_PROFIT_USD);
  });
});

// ---------------------------------------------------------------------------
// Scenario tests — hand-derived synthetic timelines
// ---------------------------------------------------------------------------

describe('computePendleEarnings scenarios', () => {
  it('open position: MTM = currentValue − totalSpent + realized', () => {
    const result = compute({
      gainedPositions: [
        gained({
          pnl: { netGain: { usd: 50, asset: 50, eth: 0 }, totalSpent: { usd: 1000, asset: 1000, eth: 0 } }
        })
      ],
      dashboardPositions: [
        dashboardChain([dashboardPosition({ pt: { valuation: 980, balance: '980' } })], { open: true })
      ]
    });
    expect(result.pendleSplit).toEqual({ realizedUsd: 50, markToMarketUsd: 980 - 1000 + 50 });
    expect(result.totalEarned).toEqual({ status: 'ok', value: { usd: 30 } });
  });

  it('current value counts pt + yt + lp valuations (netGain covers whole-market activity)', () => {
    const result = compute({
      gainedPositions: [
        gained({
          pnl: { netGain: { usd: 0, asset: 0, eth: 0 }, totalSpent: { usd: 100, asset: 100, eth: 0 } }
        })
      ],
      dashboardPositions: [
        dashboardChain([
          dashboardPosition({
            pt: { valuation: 100, balance: '100' },
            yt: { valuation: 5, balance: '5' },
            lp: { valuation: 20, balance: '20' }
          })
        ])
      ]
    });
    expect(result.pendleSplit).toEqual({ realizedUsd: 0, markToMarketUsd: 100 + 5 + 20 - 100 });
  });

  it('negative net gain renders signed, never clamped', () => {
    const result = compute({
      gainedPositions: [
        gained({
          pnl: { netGain: { usd: -100, asset: -100, eth: 0 }, totalSpent: { usd: 0, asset: 0, eth: 0 } }
        })
      ]
    });
    expect(result.totalEarned).toEqual({ status: 'ok', value: { usd: -100 } });
    expect(result.pendleSplit).toEqual({ realizedUsd: -100, markToMarketUsd: -100 });
  });

  it('wallet with no Pendle data at all → honest zero on both figures', () => {
    const result = compute();
    expect(result.totalEarned).toEqual({ status: 'ok', value: { usd: 0 } });
    expect(result.earnedThisMonth).toEqual({ status: 'ok', value: { usd: 0 } });
    expect(result.pendleSplit).toEqual({ realizedUsd: 0, markToMarketUsd: 0 });
  });

  it('same market address on a foreign chain is excluded everywhere', () => {
    const result = compute({
      gainedPositions: [
        gained({
          chainId: 42161,
          pnl: { netGain: { usd: 500, asset: 500, eth: 0 }, totalSpent: { usd: 0, asset: 0, eth: 0 } }
        })
      ],
      dashboardPositions: [
        dashboardChain([dashboardPosition({ pt: { valuation: 700, balance: '700' } })], { chainId: 42161 })
      ],
      pnlRows: [row({ chainId: 42161 })]
    });
    expect(result.totalEarned).toEqual({ status: 'ok', value: { usd: 0 } });
    expect(result.earnedThisMonth).toEqual({ status: 'ok', value: { usd: 0 } });
  });

  it('matches wire market forms case-insensitively (raw address and chainId-prefixed)', () => {
    const upper = SYNTH_MARKET.toUpperCase().replace('0X', '0x');
    const result = compute({
      gainedPositions: [
        gained({
          market: upper,
          pnl: { netGain: { usd: 40, asset: 40, eth: 0 }, totalSpent: { usd: 0, asset: 0, eth: 0 } }
        })
      ],
      dashboardPositions: [dashboardChain([dashboardPosition({ marketId: `1-${upper}` })])],
      pnlRows: [row({ market: `1-${upper}` })]
    });
    expect(result.totalEarned).toEqual({ status: 'ok', value: { usd: 40 } });
    expect(result.earnedThisMonth).toEqual({ status: 'ok', value: { usd: 10 } });
  });

  it('monthly window: t === startSec is in, earlier and later rows are out', () => {
    const result = compute({
      pnlRows: [
        row({ timestamp: '2026-08-01T00:00:00.000Z', profit: { usd: 7 }, txHash: '0x1' }),
        row({ timestamp: '2026-07-31T23:59:59.000Z', profit: { usd: 100 }, txHash: '0x2' }),
        row({ timestamp: '2026-08-19T12:00:01.000Z', profit: { usd: 100 }, txHash: '0x3' })
      ]
    });
    expect(result.earnedThisMonth).toEqual({ status: 'ok', value: { usd: 7 } });
  });

  it('missing profit.usd on an in-window row degrades monthly — never a partial sum', () => {
    const result = compute({
      pnlRows: [row({ profit: { usd: 10 }, txHash: '0x1' }), row({ profit: undefined, txHash: '0x2' })]
    });
    expect(result.earnedThisMonth).toEqual({ status: 'notAvailable', reason: 'reconciliation-failed' });
    // Total is independent of the monthly degrade.
    expect(result.totalEarned).toEqual({ status: 'ok', value: { usd: 0 } });
  });

  it('missing profit.usd outside the window or outside our markets does not degrade', () => {
    const result = compute({
      pnlRows: [
        row({ profit: { usd: 10 }, txHash: '0x1' }),
        row({ profit: undefined, timestamp: '2026-06-01T00:00:00.000Z', txHash: '0x2' }),
        row({ profit: undefined, market: '0xbbbb000000000000000000000000000000000001', txHash: '0x3' })
      ]
    });
    expect(result.earnedThisMonth).toEqual({ status: 'ok', value: { usd: 10 } });
  });

  it('unparseable timestamp on an in-scope row degrades monthly', () => {
    const result = compute({
      pnlRows: [row({ timestamp: 'not-a-date' as unknown as string })]
    });
    expect(result.earnedThisMonth).toEqual({ status: 'notAvailable', reason: 'reconciliation-failed' });
  });

  it('non-finite netGain degrades total and drops the split, monthly unaffected', () => {
    const result = compute({
      gainedPositions: [
        gained({ pnl: { netGain: { usd: NaN, asset: 0, eth: 0 }, totalSpent: { usd: 0, asset: 0, eth: 0 } } })
      ],
      pnlRows: [row({ profit: { usd: 10 } })]
    });
    expect(result.totalEarned).toEqual({ status: 'notAvailable', reason: 'reconciliation-failed' });
    expect(result.pendleSplit).toBeUndefined();
    expect(result.earnedThisMonth).toEqual({ status: 'ok', value: { usd: 10 } });
  });

  it('non-finite dashboard valuation on an in-scope market degrades total', () => {
    const result = compute({
      gainedPositions: [gained()],
      dashboardPositions: [
        dashboardChain([dashboardPosition({ pt: { valuation: NaN, balance: '0' } })], { open: true })
      ]
    });
    expect(result.totalEarned).toEqual({ status: 'notAvailable', reason: 'reconciliation-failed' });
    expect(result.pendleSplit).toBeUndefined();
  });
});
