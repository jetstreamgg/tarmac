import { describe, expect, it } from 'vitest';
import type {
  VaultsFyiPartialReturnsRaw,
  VaultsFyiReturnsRaw
} from '../../../hooks/vaults/fyi/vaultsFyiClient';
import { computeSavingsEarnings } from './computeSavingsEarnings';
import type { EarningsWindow } from './types';
import goldenFixture from './vaultsFyiReturns.golden.fixtures.json';

/**
 * Scenario tests use synthetic payloads (decimals: 6 keeps arithmetic
 * visible); the golden block at the bottom pins live API bodies captured
 * 2026-08-20 through the proxy route. Live findings folded in here: the
 * ticket's reference wallet (0x8583…) had fully exited sUSDS and vaults.fyi
 * reports returnsNative "0" for exited positions (unlike Morpho, which keeps
 * lifetime PnL) — so the golden pair is a live holder (0x0858…) plus the
 * exited wallet pinning the zeroing semantics.
 */

const AUG_WINDOW: EarningsWindow = {
  startSec: Date.UTC(2026, 7, 1) / 1000,
  endSec: Date.UTC(2026, 7, 19, 12) / 1000
};

// decimals: 6 keeps the scaling arithmetic visible: 46400000 / 10^6 = 46.4
function totalPayload(overrides: Partial<VaultsFyiReturnsRaw> = {}): VaultsFyiReturnsRaw {
  return {
    address: '0xdc035d45d973e3ec169d2276ddab16f1e407384f',
    symbol: 'USDS',
    decimals: 6,
    assetPriceInUsd: '1',
    returnsNative: '46400000',
    ...overrides
  };
}

function partialPayload(overrides: Partial<VaultsFyiPartialReturnsRaw> = {}): VaultsFyiPartialReturnsRaw {
  return {
    ...totalPayload(),
    returnsNative: '5000000',
    fromTimestamp: AUG_WINDOW.startSec,
    toTimestamp: AUG_WINDOW.endSec,
    ...overrides
  };
}

function compute({
  total = totalPayload(),
  partial = partialPayload(),
  window = AUG_WINDOW
}: {
  total?: VaultsFyiReturnsRaw;
  partial?: VaultsFyiPartialReturnsRaw;
  window?: EarningsWindow;
} = {}) {
  return computeSavingsEarnings({ totalReturns: total, partialReturns: partial, window });
}

describe('computeSavingsEarnings — total earned', () => {
  it('scales returnsNative by decimals and values at assetPriceInUsd: 46400000/10^6 × 1 = 46.4', () => {
    const { totalEarned } = compute();
    expect(totalEarned).toEqual({
      status: 'ok',
      value: { usd: 46.4, native: { amount: 46.4, symbol: 'USDS' } }
    });
  });

  it('applies a non-1 price to usd only, native stays in token units: 46.4 × 0.5 = 23.2', () => {
    const { totalEarned } = compute({ total: totalPayload({ assetPriceInUsd: '0.5' }) });
    expect(totalEarned).toEqual({
      status: 'ok',
      value: { usd: 23.2, native: { amount: 46.4, symbol: 'USDS' } }
    });
  });

  it('zero returns is a factual ok(0), not a gap', () => {
    const { totalEarned } = compute({ total: totalPayload({ returnsNative: '0' }) });
    expect(totalEarned).toEqual({ status: 'ok', value: { usd: 0, native: { amount: 0, symbol: 'USDS' } } });
  });

  it('negative returns pass through signed: -5000000/10^6 = -5', () => {
    const { totalEarned } = compute({ total: totalPayload({ returnsNative: '-5000000' }) });
    expect(totalEarned).toEqual({
      status: 'ok',
      value: { usd: -5, native: { amount: -5, symbol: 'USDS' } }
    });
  });

  it('DEGRADES on a decimal-string returnsNative — the base-units hypothesis gate', () => {
    // If vaults.fyi actually sends already-scaled decimals ("46.4"), scaling by
    // 10^decimals would render a figure 10^6–10^18 times too large. The gate
    // turns that into a dash until the QA golden settles the units.
    const { totalEarned } = compute({ total: totalPayload({ returnsNative: '46.4' }) });
    expect(totalEarned).toEqual({ status: 'notAvailable', reason: 'reconciliation-failed' });
  });

  it.each([
    ['missing returnsNative', { returnsNative: undefined }],
    ['non-numeric returnsNative', { returnsNative: 'abc' }],
    ['missing assetPriceInUsd', { assetPriceInUsd: undefined }],
    ['non-numeric assetPriceInUsd', { assetPriceInUsd: 'abc' }],
    ['missing decimals', { decimals: undefined }],
    ['fractional decimals', { decimals: 1.5 }],
    ['negative decimals', { decimals: -1 }],
    ['absurd decimals', { decimals: 40 }],
    ['missing symbol', { symbol: undefined }],
    ['empty symbol', { symbol: '' }]
  ] as const)('degrades to reconciliation-failed on %s', (_label, overrides) => {
    const { totalEarned } = compute({ total: totalPayload(overrides) });
    expect(totalEarned).toEqual({ status: 'notAvailable', reason: 'reconciliation-failed' });
  });
});

describe('computeSavingsEarnings — earned this month', () => {
  it('parses the window payload: 5000000/10^6 × 1 = 5', () => {
    const { earnedThisMonth } = compute();
    expect(earnedThisMonth).toEqual({
      status: 'ok',
      value: { usd: 5, native: { amount: 5, symbol: 'USDS' } }
    });
  });

  it('accepts a resolved start LATER than the window start (position younger than the month)', () => {
    const { earnedThisMonth } = compute({
      partial: partialPayload({ fromTimestamp: AUG_WINDOW.startSec + 86400 })
    });
    expect(earnedThisMonth.status).toBe('ok');
  });

  it('accepts a resolved start slightly before the window start (live API snaps to a sample 1s early)', () => {
    const { earnedThisMonth } = compute({
      partial: partialPayload({ fromTimestamp: AUG_WINDOW.startSec - 1 })
    });
    expect(earnedThisMonth.status).toBe('ok');
  });

  it('accepts a resolved start exactly at the one-hour tolerance boundary', () => {
    const { earnedThisMonth } = compute({
      partial: partialPayload({ fromTimestamp: AUG_WINDOW.startSec - 3600 })
    });
    expect(earnedThisMonth.status).toBe('ok');
  });

  it('DEGRADES when the resolved start is more than an hour before the window start (would include pre-month earnings)', () => {
    const { earnedThisMonth } = compute({
      partial: partialPayload({ fromTimestamp: AUG_WINDOW.startSec - 3601 })
    });
    expect(earnedThisMonth).toEqual({ status: 'notAvailable', reason: 'reconciliation-failed' });
  });

  it('accepts a resolved end slightly past the window end (fetch completes after the window is computed)', () => {
    const { earnedThisMonth } = compute({
      partial: partialPayload({ toTimestamp: AUG_WINDOW.endSec + 60 })
    });
    expect(earnedThisMonth.status).toBe('ok');
  });

  it.each([
    ['missing fromTimestamp', { fromTimestamp: undefined }],
    ['missing toTimestamp', { toTimestamp: undefined }],
    ['inverted boundaries', { fromTimestamp: AUG_WINDOW.endSec, toTimestamp: AUG_WINDOW.startSec }]
  ] as const)('degrades to reconciliation-failed on %s', (_label, overrides) => {
    const { earnedThisMonth } = compute({ partial: partialPayload(overrides) });
    expect(earnedThisMonth).toEqual({ status: 'notAvailable', reason: 'reconciliation-failed' });
  });

  it('shares the value gates with the total figure (decimal-string returnsNative degrades)', () => {
    const { earnedThisMonth } = compute({ partial: partialPayload({ returnsNative: '5.0' }) });
    expect(earnedThisMonth).toEqual({ status: 'notAvailable', reason: 'reconciliation-failed' });
  });
});

describe('computeSavingsEarnings — figure independence', () => {
  it('a broken total payload does not sink the monthly figure', () => {
    const { totalEarned, earnedThisMonth } = compute({
      total: totalPayload({ returnsNative: 'abc' })
    });
    expect(totalEarned.status).toBe('notAvailable');
    expect(earnedThisMonth.status).toBe('ok');
  });

  it('a broken monthly payload does not sink the total figure', () => {
    const { totalEarned, earnedThisMonth } = compute({
      partial: partialPayload({ fromTimestamp: undefined })
    });
    expect(totalEarned.status).toBe('ok');
    expect(earnedThisMonth.status).toBe('notAvailable');
  });
});

describe('golden fixtures (live API bodies, captured 2026-08-20 via the proxy route)', () => {
  // Requested fromTimestamp was 1785542400 (Aug 1 2026 00:00 UTC) for both
  // wallets; the live holder's echo came back 1s earlier — the observation
  // behind WINDOW_START_TOLERANCE_SEC.
  const GOLDEN_WINDOW: EarningsWindow = { startSec: 1785542400, endSec: 1787215111 };

  // --- Hand-derived from the frozen fixture strings (never from the code under test) ---
  const GOLDEN_PRICE = Number('0.9999561');
  const GOLDEN_TOTAL_NATIVE = Number('105777124203820296734810') / 1e18; // ≈ 105,777.12 USDS lifetime
  const GOLDEN_MONTH_NATIVE = Number('945522329409243189511') / 1e18; // ≈ 945.52 USDS Aug 1–20

  it('live holder: lifetime and month-to-date figures parse from the real wire values', () => {
    const { totalEarned, earnedThisMonth } = computeSavingsEarnings({
      totalReturns: goldenFixture.totalReturnsLive,
      partialReturns: goldenFixture.partialReturnsLive,
      window: GOLDEN_WINDOW
    });
    expect(totalEarned).toEqual({
      status: 'ok',
      value: {
        usd: GOLDEN_TOTAL_NATIVE * GOLDEN_PRICE,
        native: { amount: GOLDEN_TOTAL_NATIVE, symbol: 'USDS' }
      }
    });
    expect(earnedThisMonth).toEqual({
      status: 'ok',
      value: {
        usd: GOLDEN_MONTH_NATIVE * GOLDEN_PRICE,
        native: { amount: GOLDEN_MONTH_NATIVE, symbol: 'USDS' }
      }
    });
  });

  it('live holder: the real 1s-early resolved start passes the tolerance gate', () => {
    expect(goldenFixture.partialReturnsLive.fromTimestamp).toBe(GOLDEN_WINDOW.startSec - 1);
    const { earnedThisMonth } = computeSavingsEarnings({
      totalReturns: goldenFixture.totalReturnsLive,
      partialReturns: goldenFixture.partialReturnsLive,
      window: GOLDEN_WINDOW
    });
    expect(earnedThisMonth.status).toBe('ok');
  });

  it('exited wallet: vaults.fyi zeroes returns after a full exit — parses as a factual ok(0), not a gap', () => {
    // Divergence from Morpho semantics (which keeps lifetime PnL at 0 balance):
    // an exited savings position reports $0 earned, documented in the PR.
    const { totalEarned, earnedThisMonth } = computeSavingsEarnings({
      totalReturns: goldenFixture.totalReturnsExited,
      partialReturns: goldenFixture.partialReturnsExited,
      window: GOLDEN_WINDOW
    });
    expect(totalEarned).toEqual({
      status: 'ok',
      value: { usd: 0, native: { amount: 0, symbol: 'USDS' } }
    });
    expect(earnedThisMonth).toEqual({
      status: 'ok',
      value: { usd: 0, native: { amount: 0, symbol: 'USDS' } }
    });
  });
});
