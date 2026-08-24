import { describe, expect, it } from 'vitest';
import { MorphoTransactionType } from '../../../hooks/morpho/constants';
import type {
  MorphoUserVaultV2PnlApiResponse,
  MorphoUserVaultV2Position,
  MorphoVaultV2Transaction,
  MorphoVaultV2TransactionsApiResponse
} from '../../../hooks/morpho/morpho';
import { computeMorphoEarnings, type MorphoEarningsInput } from './computeMorphoEarnings';
import { FLOW_SCENARIOS, type FlowScenario } from './flowScenarios.fixtures';
import { notAvailable, ok, type EarningsWindow } from './types';
import pnlFixture from './morphoUserVaultV2Pnl.golden.fixtures.json';
import txFixture from './morphoVaultV2Transactions.golden.fixtures.json';

const FLAGSHIP = '0xE15fcC81118895b67b6647BBd393182dF44E11E0';
const USDC_VAULT = '0x56bfa6f53669B836D1E0Dfa5e99706b12c373ecf';
const AUG_1 = 1785542400; // externally anchored Aug 1 2026 00:00 UTC
const DAY = 86400;
// Same window the section-2 tests use; any endSec after the wallet's Aug 14 exit works.
const GOLDEN_WINDOW: EarningsWindow = { startSec: AUG_1, endSec: 1787140800 };

// --- Golden expectations, hand-derived from the frozen fixtures (never from the code under test) ---

// Fixture pnlUsd / pnl for the Flagship USDS position. Base-unit values are kept
// as the exact fixture strings (they exceed float64 precision as decimal literals).
const GOLDEN_TOTAL_USD = 875.0952049047648;
const GOLDEN_TOTAL_NATIVE = Number('875057747029463685691') / 1e18;

// Flows method over the fixture transactions (all inside the August window):
const START = Number('200080001947584340947422') / 1e18; // history sample y at x = 1785542400 (Aug 1 00:00Z)
const DEPOSITS =
  (Number('149999475611846509621144') +
    Number('100680688839282031791894') +
    Number('150691263509000000000000') +
    Number('50000000000000000000000')) /
  1e18;
const WITHDRAWALS =
  (Number('251526540428264896079671') +
    Number('100000000000000000000000') +
    Number('100000000000000000000000') +
    Number('50000000000000000000000') +
    Number('50000000000000000000000') +
    Number('100000000000000000000000')) /
  1e18;
// Wallet exited Aug 14 → end balance 0. ≈ 75.11 USDS, the live-verified spike figure.
const GOLDEN_MONTH_NATIVE = 0 - START - DEPOSITS + WITHDRAWALS;
// Exited position → USD via the implied rate pnlUsd/pnl (assets are 0, so assetsUsd/assets is unusable).
const GOLDEN_MONTH_USD = GOLDEN_MONTH_NATIVE * (GOLDEN_TOTAL_USD / GOLDEN_TOTAL_NATIVE);

const goldenPositions = (pnlFixture as unknown as MorphoUserVaultV2PnlApiResponse).data.userByAddress!
  .vaultV2Positions;
const goldenTransactions = (txFixture as unknown as MorphoVaultV2TransactionsApiResponse).data
  .vaultV2transactions.items;

const goldenInput: MorphoEarningsInput = {
  positions: goldenPositions,
  transactions: goldenTransactions,
  // Lowercased on purpose: the fixture address is checksummed, matching must be case-insensitive.
  vaultAddress: FLAGSHIP.toLowerCase(),
  window: GOLDEN_WINDOW
};

// --- Scenario mapping helpers: exact 18-decimal base-unit strings from ≤2-decimal amounts ---

const u = (v: number): string => (BigInt(Math.round(v * 100)) * 10n ** 16n).toString();

const position = (overrides: Partial<MorphoUserVaultV2Position>): MorphoUserVaultV2Position => ({
  vault: { address: FLAGSHIP, asset: { symbol: 'USDS', decimals: 18 } },
  assets: '0',
  assetsUsd: 0,
  pnl: '0',
  pnlUsd: 0,
  roe: null,
  history: { assets: [] },
  ...overrides
});

const tx = (type: MorphoTransactionType, timestamp: number, assets: number): MorphoVaultV2Transaction => ({
  vault: { address: FLAGSHIP, asset: { symbol: 'USDS', decimals: 18 } },
  type,
  timestamp,
  txHash: '0xtest',
  data: { assets: u(assets) }
});

// Scenarios use a $1 price (assetsUsd === endAssets) so usd must equal native.
const scenarioInput = (s: FlowScenario): MorphoEarningsInput => ({
  positions: [
    position({
      assets: u(s.endAssets),
      assetsUsd: s.endAssets,
      history: {
        // Newest-first, as the API returns the series.
        assets: [
          { x: s.window.endSec, y: u(s.endAssets) },
          { x: s.window.startSec, y: u(s.startAssets) }
        ]
      }
    })
  ],
  transactions: [
    ...s.deposits.map(([t, assets]) => tx(MorphoTransactionType.Deposit, t, assets)),
    ...s.withdrawals.map(([t, assets]) => tx(MorphoTransactionType.Withdraw, t, assets))
  ],
  vaultAddress: FLAGSHIP,
  window: s.window
});

describe('computeMorphoEarnings', () => {
  describe('golden fixture (reference wallet, August 2026)', () => {
    it('reports total earned from pnl/pnlUsd of the Flagship position only', () => {
      const { totalEarned } = computeMorphoEarnings(goldenInput);
      expect(totalEarned.status).toBe('ok');
      if (totalEarned.status !== 'ok') return;
      // The USDC position (pnlUsd 1045.46) must NOT leak into the Flagship figure.
      expect(totalEarned.value.usd).toBeCloseTo(GOLDEN_TOTAL_USD, 8);
      expect(totalEarned.value.native?.symbol).toBe('USDS');
      expect(totalEarned.value.native?.amount).toBeCloseTo(GOLDEN_TOTAL_NATIVE, 6);
    });

    it('reproduces the live-verified August earnings via the flows method', () => {
      const { earnedThisMonth } = computeMorphoEarnings(goldenInput);
      expect(earnedThisMonth.status).toBe('ok');
      if (earnedThisMonth.status !== 'ok') return;
      expect(earnedThisMonth.value.native?.amount).toBeCloseTo(GOLDEN_MONTH_NATIVE, 6);
      expect(earnedThisMonth.value.native?.amount).toBeCloseTo(75.11, 2);
      expect(earnedThisMonth.value.usd).toBeCloseTo(GOLDEN_MONTH_USD, 6);
    });

    it('returns zero figures when the wallet has no Flagship position', () => {
      const usdcOnly = goldenPositions.filter(p => p.vault.address.toLowerCase() !== FLAGSHIP.toLowerCase());
      const result = computeMorphoEarnings({ ...goldenInput, positions: usdcOnly });
      expect(result.totalEarned).toEqual(ok({ usd: 0 }));
      expect(result.earnedThisMonth).toEqual(ok({ usd: 0 }));
    });

    // Scope extension (Kuba 2026-08-21): every supported vault gets its own
    // per-vault figures — the USDC position graduates from "must not leak"
    // to its own expectations.
    it('reports the USDC vault total from its own pnl pair when asked for that vault', () => {
      const { totalEarned } = computeMorphoEarnings({ ...goldenInput, vaultAddress: USDC_VAULT });
      expect(totalEarned.status).toBe('ok');
      if (totalEarned.status !== 'ok') return;
      expect(totalEarned.value.usd).toBeCloseTo(1045.4605704344526, 8);
      expect(totalEarned.value.native?.symbol).toBe('USDC');
      // pnl is serialized as a plain number for this position (6 decimals).
      expect(totalEarned.value.native?.amount).toBeCloseTo(1045789960 / 1e6, 8);
    });

    it('reports an exact zero August for the USDC vault (exited before the window)', () => {
      const { earnedThisMonth } = computeMorphoEarnings({ ...goldenInput, vaultAddress: USDC_VAULT });
      // Baseline 0 at Aug 1, no flows, end balance 0 → earned exactly 0.
      expect(earnedThisMonth).toEqual(ok({ usd: 0, native: { amount: 0, symbol: 'USDC' } }));
    });
  });

  describe('flow scenarios (executable spec from flowScenarios.fixtures)', () => {
    it.each(FLOW_SCENARIOS.map(s => [s.name, s] as const))('%s', (_name, scenario) => {
      const { earnedThisMonth } = computeMorphoEarnings(scenarioInput(scenario));
      expect(earnedThisMonth.status).toBe('ok');
      if (earnedThisMonth.status !== 'ok') return;
      expect(earnedThisMonth.value.native?.symbol).toBe('USDS');
      expect(earnedThisMonth.value.native?.amount).toBeCloseTo(scenario.expectedEarned, 10);
      expect(earnedThisMonth.value.usd).toBeCloseTo(scenario.expectedEarned, 10);
    });

    it('yields exactly zero (not ~zero) for the zero-yield scenario', () => {
      const zero = FLOW_SCENARIOS.find(s => s.name === 'zero yield is exactly zero')!;
      const { earnedThisMonth } = computeMorphoEarnings(scenarioInput(zero));
      if (earnedThisMonth.status !== 'ok') throw new Error('expected ok');
      expect(earnedThisMonth.value.native?.amount).toBe(0);
      expect(earnedThisMonth.value.usd).toBe(0);
    });
  });

  describe('baseline sample selection', () => {
    const window: EarningsWindow = { startSec: AUG_1, endSec: AUG_1 + 10 * DAY };

    it('picks the newest sample at or before startSec, not the first or last element', () => {
      const newestFirst = [
        { x: AUG_1 + DAY, y: u(300) },
        { x: AUG_1, y: u(110) },
        { x: AUG_1 - DAY, y: u(100) }
      ];
      const input = (series: { x: number; y: string }[]): MorphoEarningsInput => ({
        positions: [position({ assets: u(300), assetsUsd: 300, history: { assets: series } })],
        transactions: [],
        vaultAddress: FLAGSHIP,
        window
      });
      // earned = 300 − 110 (the x = startSec sample wins over the older one)
      for (const series of [newestFirst, [...newestFirst].reverse()]) {
        const { earnedThisMonth } = computeMorphoEarnings(input(series));
        if (earnedThisMonth.status !== 'ok') throw new Error('expected ok');
        expect(earnedThisMonth.value.native?.amount).toBeCloseTo(300 - 110, 10);
      }
    });

    it('uses baseline 0 when no sample exists at or before startSec (opened mid-month)', () => {
      const { earnedThisMonth } = computeMorphoEarnings({
        positions: [
          position({
            assets: u(1002),
            assetsUsd: 1002,
            history: { assets: [{ x: AUG_1 + 5 * DAY, y: u(1000) }] }
          })
        ],
        transactions: [tx(MorphoTransactionType.Deposit, AUG_1 + 5 * DAY, 1000)],
        vaultAddress: FLAGSHIP,
        window
      });
      if (earnedThisMonth.status !== 'ok') throw new Error('expected ok');
      // earned = 1002 − 0 − 1000
      expect(earnedThisMonth.value.native?.amount).toBeCloseTo(1002 - 1000, 10);
    });

    // Post-merge review finding #1: a series that starts AFTER startSec is no
    // better than an empty one — a long-standing position with a truncated
    // series must degrade, not render its whole balance as monthly earnings.
    it('degrades when the series starts after startSec and flows leave the balance unexplained', () => {
      const result = computeMorphoEarnings({
        positions: [
          position({
            assets: u(50000),
            assetsUsd: 50000,
            // First sample lands after the month start (e.g. the API skipped
            // the boundary bucket) — 50k of pre-existing balance, no flows.
            history: { assets: [{ x: AUG_1 + 2 * DAY, y: u(49990) }] }
          })
        ],
        transactions: [],
        vaultAddress: FLAGSHIP,
        window
      });
      expect(result.earnedThisMonth).toEqual(notAvailable('reconciliation-failed'));
    });

    // Review finding #9: a position opened today has flows but no history
    // sample yet — the empty series is expected, not a data failure, whenever
    // the window's flows explain the end balance.
    it('accepts baseline 0 for an empty series when flows explain the balance (opened today)', () => {
      const result = computeMorphoEarnings({
        positions: [position({ assets: u(1000.5), assetsUsd: 1000.5, history: { assets: [] } })],
        transactions: [tx(MorphoTransactionType.Deposit, AUG_1 + 5 * DAY, 1000)],
        vaultAddress: FLAGSHIP,
        window
      });
      if (result.earnedThisMonth.status !== 'ok') throw new Error('expected ok');
      // earned = 1000.5 − 0 − 1000
      expect(result.earnedThisMonth.value.native?.amount).toBeCloseTo(0.5, 10);
      expect(result.earnedThisMonth.value.usd).toBeCloseTo(0.5, 10);
    });

    it('accepts an empty series for a same-window round trip (opened and exited today)', () => {
      const result = computeMorphoEarnings({
        // Exited → the USD rate comes from the pnl pair, so pnl must be real.
        positions: [position({ pnl: u(0.4), pnlUsd: 0.4, history: { assets: [] } })],
        transactions: [
          tx(MorphoTransactionType.Deposit, AUG_1 + 5 * DAY, 1000),
          tx(MorphoTransactionType.Withdraw, AUG_1 + 5 * DAY, 1000.4)
        ],
        vaultAddress: FLAGSHIP,
        window
      });
      if (result.earnedThisMonth.status !== 'ok') throw new Error('expected ok');
      // earned = 0 − 0 − 1000 + 1000.4
      expect(result.earnedThisMonth.value.native?.amount).toBeCloseTo(0.4, 10);
    });

    it('still degrades an empty series when flows leave the balance unexplained', () => {
      const result = computeMorphoEarnings({
        positions: [position({ assets: u(1200), assetsUsd: 1200, history: { assets: [] } })],
        transactions: [tx(MorphoTransactionType.Deposit, AUG_1 + 5 * DAY, 1000)],
        vaultAddress: FLAGSHIP,
        window
      });
      // A 20% gap is not same-day yield — the history is genuinely missing.
      expect(result.earnedThisMonth).toEqual(notAvailable('reconciliation-failed'));
    });

    it('degrades to reconciliation-failed when the series is empty but the position is live', () => {
      const result = computeMorphoEarnings({
        positions: [
          position({ assets: u(10), assetsUsd: 10, pnl: u(0.5), pnlUsd: 0.5, history: { assets: [] } })
        ],
        transactions: [],
        vaultAddress: FLAGSHIP,
        window
      });
      expect(result.earnedThisMonth).toEqual(notAvailable('reconciliation-failed'));
      // Total earned does not depend on the series and must survive.
      expect(result.totalEarned).toEqual(ok({ usd: 0.5, native: { amount: 0.5, symbol: 'USDS' } }));
    });

    it('degrades when the series is empty and in-window flows exist (baseline unknowable)', () => {
      const result = computeMorphoEarnings({
        positions: [position({ history: null })],
        transactions: [tx(MorphoTransactionType.Withdraw, AUG_1 + DAY, 500)],
        vaultAddress: FLAGSHIP,
        window
      });
      expect(result.earnedThisMonth).toEqual(notAvailable('reconciliation-failed'));
    });

    it('reports an exact zero month for an empty series with no balance and no flows', () => {
      const result = computeMorphoEarnings({
        positions: [position({ history: null })],
        transactions: [],
        vaultAddress: FLAGSHIP,
        window
      });
      expect(result.earnedThisMonth).toEqual(ok({ usd: 0, native: { amount: 0, symbol: 'USDS' } }));
    });
  });

  describe('input hygiene', () => {
    it('parses pnl and series values serialized as plain numbers (USDC-style, 6 decimals)', () => {
      const result = computeMorphoEarnings({
        positions: [
          {
            vault: { address: FLAGSHIP, asset: { symbol: 'USDC', decimals: 6 } },
            assets: 0,
            assetsUsd: 0,
            pnl: 1045789960,
            pnlUsd: 1045.4605704344526,
            roe: null,
            history: { assets: [{ x: AUG_1, y: 0 }] }
          }
        ],
        transactions: [],
        vaultAddress: FLAGSHIP,
        window: GOLDEN_WINDOW
      });
      if (result.totalEarned.status !== 'ok') throw new Error('expected ok');
      expect(result.totalEarned.value.native?.amount).toBeCloseTo(1045789960 / 1e6, 8);
      if (result.earnedThisMonth.status !== 'ok') throw new Error('expected ok');
      expect(result.earnedThisMonth.value.native?.amount).toBe(0);
    });

    it('counts only flows inside [startSec, endSec] for the Flagship vault', () => {
      const window: EarningsWindow = { startSec: AUG_1, endSec: AUG_1 + 10 * DAY };
      const { earnedThisMonth } = computeMorphoEarnings({
        positions: [
          position({
            assets: u(8004),
            assetsUsd: 8004,
            history: { assets: [{ x: AUG_1, y: u(0) }] }
          })
        ],
        transactions: [
          tx(MorphoTransactionType.Deposit, AUG_1 - 1, 3000), // before the window → ignored
          tx(MorphoTransactionType.Deposit, AUG_1, 5000), // t ≥ startSec → counted
          tx(MorphoTransactionType.Withdraw, AUG_1 + 10 * DAY + 1, 100) // after endSec → ignored
        ],
        vaultAddress: FLAGSHIP,
        window
      });
      if (earnedThisMonth.status !== 'ok') throw new Error('expected ok');
      // Mechanical filter pin (economics intentionally incoherent): 8004 − 0 − 5000
      expect(earnedThisMonth.value.native?.amount).toBeCloseTo(8004 - 5000, 10);
    });
  });
});
