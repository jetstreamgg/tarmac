import { describe, expect, it } from 'vitest';
import type {
  VaultsFyiPartialReturnsRaw,
  VaultsFyiReturnsRaw
} from '../../../hooks/vaults/fyi/vaultsFyiClient';
import { computeSavingsEarnings, stUsdsPlaceholderEarnings } from './computeSavingsEarnings';
import type { EarningsWindow } from './types';

/**
 * Scenario tests only: vaults.fyi is key-gated and NO live fixture exists yet,
 * so there is no golden test here. The wire shape below comes from the official
 * OpenAPI specs (2026-08-19); the golden (ref wallet 0x8583…, Aug ~46.4 USDS)
 * lands at QA once the key exists. Until then every parse is hard-gated and
 * any surprise degrades — a wrong number is worse than no number.
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

  it('DEGRADES when the resolved start is EARLIER than the window start (would include pre-month earnings)', () => {
    const { earnedThisMonth } = compute({
      partial: partialPayload({ fromTimestamp: AUG_WINDOW.startSec - 1 })
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

describe('stUsdsPlaceholderEarnings', () => {
  it('reports both figures as the announced stusds-not-listed gap', () => {
    expect(stUsdsPlaceholderEarnings()).toEqual({
      totalEarned: { status: 'notAvailable', reason: 'stusds-not-listed' },
      earnedThisMonth: { status: 'notAvailable', reason: 'stusds-not-listed' }
    });
  });
});
