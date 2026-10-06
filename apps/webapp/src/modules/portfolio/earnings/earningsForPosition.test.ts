import { describe, expect, it } from 'vitest';
import { earningsForPosition, earningsForSuppliedPositions } from './earningsForPosition';
import { notAvailable, ok, type ProtocolEarnings, type WalletEarnings } from './types';

const FLAGSHIP_ROW = 'vault-morpho-0xe15fcc81118895b67b6647bbd393182df44e11e0';
const PENDLE_ROW = 'fixed-0x9c560ebaf78e596cbcc27411d633a74d628dd7dc';

const protocol = (overrides: Partial<ProtocolEarnings> & Pick<ProtocolEarnings, 'id'>): ProtocolEarnings => ({
  rowIds: [],
  totalEarned: notAvailable('source-error'),
  earnedThisMonth: notAvailable('source-error'),
  isLoading: false,
  error: null,
  ...overrides
});

const wallet = (protocols: ProtocolEarnings[]): WalletEarnings => ({
  protocols,
  combined: { totalEarnedUsd: 0, earnedThisMonthUsd: 0, missingFromTotal: [], missingFromMonth: [] },
  isLoading: false,
  window: { startSec: 1785542400, endSec: 1787140800 }
});

const morpho = protocol({
  id: 'morpho-vault-0xflagship',
  rowIds: [FLAGSHIP_ROW],
  totalEarned: ok({ usd: 875.06, native: { amount: 875.06, symbol: 'USDS' } }),
  earnedThisMonth: ok({ usd: 75.11, native: { amount: 75.11, symbol: 'USDS' } })
});
const merkl = protocol({
  id: 'merkl',
  rowIds: [FLAGSHIP_ROW],
  totalEarned: ok({ usd: 8456.48, byToken: [{ amount: 8456.48, symbol: 'USDS' }] }),
  earnedThisMonth: notAvailable('merkl-monthly-unsupported')
});
const pendle = protocol({
  id: 'pendle-market-0xmkt',
  rowIds: [PENDLE_ROW],
  totalEarned: ok({ usd: 916.82 }),
  earnedThisMonth: ok({ usd: 635.39 }),
  pendleSplit: { realizedUsd: 895.05, markToMarketUsd: 916.82 }
});
const savings = protocol({
  id: 'savings',
  rowIds: ['savings'],
  totalEarned: ok({ usd: 120.5, native: { amount: 118.2, symbol: 'sUSDS' } }),
  earnedThisMonth: ok({ usd: 46.4, native: { amount: 45.5, symbol: 'sUSDS' } })
});
const stusds = protocol({
  id: 'stusds',
  rowIds: ['stusds'],
  totalEarned: notAvailable('source-error'),
  earnedThisMonth: notAvailable('source-error')
});

const earnings = wallet([morpho, merkl, pendle, savings, stusds]);

describe('earningsForPosition', () => {
  it('sums Morpho pnl and vault-attributed Merkl USD for the Flagship row', () => {
    const position = earningsForPosition(earnings, FLAGSHIP_ROW);
    expect(position?.totalEarned.status).toBe('ok');
    if (position?.totalEarned.status !== 'ok') return;
    expect(position.totalEarned.value.usd).toBeCloseTo(875.06 + 8456.48, 10);
    // Both contributors pay USDS → merged single-token native
    expect(position.totalEarned.value.native?.symbol).toBe('USDS');
    expect(position.totalEarned.value.native?.amount).toBeCloseTo(875.06 + 8456.48, 10);
    expect(position.missingFromTotal).toEqual([]);
  });

  it('keeps the Morpho monthly figure and flags the Merkl announced gap', () => {
    const position = earningsForPosition(earnings, FLAGSHIP_ROW);
    expect(position?.earnedThisMonth).toEqual(ok({ usd: 75.11, native: { amount: 75.11, symbol: 'USDS' } }));
    // Reasons ride along so the UI can explain the gap (review finding #1).
    expect(position?.missingFromMonth).toEqual([{ id: 'merkl', reason: 'merkl-monthly-unsupported' }]);
  });

  it('carries a per-vault label into the missing details so tooltips can name the vault', () => {
    const vault = protocol({
      id: 'morpho-vault-0xother',
      label: 'USDT Savings',
      rowIds: ['vault-morpho-0xother'],
      totalEarned: notAvailable('source-error'),
      earnedThisMonth: ok({ usd: 3 })
    });
    const position = earningsForPosition(wallet([vault]), 'vault-morpho-0xother');
    expect(position?.missingFromTotal).toEqual([
      { id: 'morpho-vault-0xother', reason: 'source-error', label: 'USDT Savings' }
    ]);
  });

  it('drops native and reports byToken when contributors pay different tokens', () => {
    const multiToken = protocol({
      id: 'merkl',
      rowIds: [FLAGSHIP_ROW],
      totalEarned: ok({
        usd: 110,
        byToken: [
          { amount: 100, symbol: 'USDS' },
          { amount: 250, symbol: 'SKY' }
        ]
      })
    });
    const position = earningsForPosition(wallet([morpho, multiToken]), FLAGSHIP_ROW);
    if (position?.totalEarned.status !== 'ok') throw new Error('expected ok');
    expect(position.totalEarned.value.usd).toBeCloseTo(875.06 + 110, 10);
    expect(position.totalEarned.value.native).toBeUndefined();
    expect(position.totalEarned.value.byToken).toEqual([
      { amount: 875.06 + 100, symbol: 'USDS' },
      { amount: 250, symbol: 'SKY' }
    ]);
  });

  it('passes Pendle figures and the realized/mark-to-market split through', () => {
    const position = earningsForPosition(earnings, PENDLE_ROW);
    expect(position?.totalEarned).toEqual(ok({ usd: 916.82 }));
    expect(position?.earnedThisMonth).toEqual(ok({ usd: 635.39 }));
    expect(position?.pendleSplit).toEqual({ realizedUsd: 895.05, markToMarketUsd: 916.82 });
  });

  it('maps the savings row to the vaults.fyi figures', () => {
    const position = earningsForPosition(earnings, 'savings');
    expect(position?.totalEarned).toEqual(ok({ usd: 120.5, native: { amount: 118.2, symbol: 'sUSDS' } }));
  });

  it("passes a contributor's coverage caveat through (review finding #3)", () => {
    const mainnetOnly = protocol({
      id: 'savings',
      rowIds: ['savings'],
      totalEarned: ok({ usd: 120.5 }),
      earnedThisMonth: ok({ usd: 46.4 }),
      coverage: 'mainnet-only'
    });
    expect(earningsForPosition(wallet([mainnetOnly]), 'savings')?.coverage).toEqual(['mainnet-only']);
    // Contributors without a caveat leave it unset.
    expect(earningsForPosition(earnings, FLAGSHIP_ROW)?.coverage).toBeUndefined();
  });

  it('returns notAvailable with the contributor reason when nothing is ok', () => {
    const position = earningsForPosition(earnings, 'stusds');
    expect(position?.totalEarned).toEqual(notAvailable('source-error'));
    expect(position?.earnedThisMonth).toEqual(notAvailable('source-error'));
    expect(position?.missingFromTotal).toEqual([{ id: 'stusds', reason: 'source-error' }]);
  });

  it('returns null for rows outside APP-450 scope', () => {
    expect(earningsForPosition(earnings, 'rewards-sky')).toBeNull();
    expect(earningsForPosition(earnings, 'vault-morpho-0xdeadbeef')).toBeNull();
  });
});

describe('earningsForSuppliedPositions', () => {
  it('merges every source behind the positions, skipping rows without one', () => {
    const slice = earningsForSuppliedPositions(earnings, [
      { rowId: 'savings', chainId: 1 },
      { rowId: PENDLE_ROW, chainId: 1 },
      { rowId: 'rewards-sky', chainId: 1 }
    ]);
    expect(slice?.totalEarned).toEqual(
      ok({ usd: 120.5 + 916.82, native: { amount: 118.2, symbol: 'sUSDS' } })
    );
    expect(slice?.earnedThisMonth).toEqual(
      ok({ usd: 46.4 + 635.39, native: { amount: 45.5, symbol: 'sUSDS' } })
    );
    // Pendle's realized/mark-to-market split no longer describes the merged figure.
    expect(slice?.pendleSplit).toBeUndefined();
  });

  it('counts a product held on two chains once, from its mainnet leg', () => {
    const slice = earningsForSuppliedPositions(earnings, [
      { rowId: 'savings', chainId: 1 },
      { rowId: 'savings', chainId: 8453 }
    ]);
    expect(slice?.totalEarned).toEqual(savings.totalEarned);
  });

  it('lists failed sources as missing while summing the rest', () => {
    const slice = earningsForSuppliedPositions(earnings, [
      { rowId: 'savings', chainId: 1 },
      { rowId: 'stusds', chainId: 1 }
    ]);
    expect(slice?.totalEarned).toEqual(savings.totalEarned);
    expect(slice?.missingFromTotal).toEqual([{ id: 'stusds', reason: 'source-error' }]);
  });

  it('returns null when no position has a mainnet source', () => {
    expect(earningsForSuppliedPositions(earnings, [{ rowId: 'rewards-sky', chainId: 1 }])).toBeNull();
    expect(earningsForSuppliedPositions(earnings, [{ rowId: 'savings', chainId: 8453 }])).toBeNull();
  });

  it('holds the merged figure as loading while any folded source is still loading', () => {
    const loadingStusds = protocol({
      id: 'stusds',
      rowIds: ['stusds'],
      totalEarned: notAvailable('loading'),
      earnedThisMonth: notAvailable('loading')
    });
    const slice = earningsForSuppliedPositions(wallet([savings, loadingStusds]), [
      { rowId: 'savings', chainId: 1 },
      { rowId: 'stusds', chainId: 1 }
    ]);
    expect(slice?.totalEarned).toEqual(notAvailable('loading'));
    expect(slice?.earnedThisMonth).toEqual(notAvailable('loading'));
  });

  it("reads only a folded Pendle market's own source, not a sibling market's", () => {
    const marketA = protocol({
      id: 'pendle-market-0xaaa',
      rowIds: ['fixed-0xaaa'],
      totalEarned: ok({ usd: 900 }),
      earnedThisMonth: ok({ usd: 90 }),
      pendleSplit: { realizedUsd: 800, markToMarketUsd: 900 }
    });
    const marketB = protocol({
      id: 'pendle-market-0xbbb',
      rowIds: ['fixed-0xbbb'],
      totalEarned: ok({ usd: 4 }),
      earnedThisMonth: ok({ usd: 1 }),
      pendleSplit: { realizedUsd: 3, markToMarketUsd: 4 }
    });
    const slice = earningsForSuppliedPositions(wallet([marketA, marketB]), [
      { rowId: 'fixed-0xbbb', chainId: 1 }
    ]);
    expect(slice?.totalEarned).toEqual(ok({ usd: 4 }));
    // One source behind the slice, so its split still describes the figure.
    expect(slice?.pendleSplit).toEqual({ realizedUsd: 3, markToMarketUsd: 4 });
  });

  it('keeps every distinct coverage caveat of a merged slice, once each', () => {
    const mainnetOnly = { ...savings, coverage: 'mainnet-only' as const };
    const rewardsMissing = protocol({
      id: 'morpho-vault-0xother',
      rowIds: ['vault-morpho-0xother'],
      totalEarned: ok({ usd: 10 }),
      earnedThisMonth: ok({ usd: 1 }),
      coverage: 'rewards-not-included'
    });
    const one = earningsForSuppliedPositions(wallet([mainnetOnly, pendle]), [
      { rowId: 'savings', chainId: 1 },
      { rowId: PENDLE_ROW, chainId: 1 }
    ]);
    expect(one?.coverage).toEqual(['mainnet-only']);
    const mixed = earningsForSuppliedPositions(wallet([mainnetOnly, rewardsMissing]), [
      { rowId: 'savings', chainId: 1 },
      { rowId: 'vault-morpho-0xother', chainId: 1 }
    ]);
    expect(mixed?.coverage).toEqual(['mainnet-only', 'rewards-not-included']);
  });
});
