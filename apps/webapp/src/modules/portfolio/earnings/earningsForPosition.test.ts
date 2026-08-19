import { describe, expect, it } from 'vitest';
import { earningsForPosition } from './earningsForPosition';
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
  id: 'morpho-flagship',
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
  id: 'pendle',
  rowIds: [PENDLE_ROW],
  totalEarned: ok({ usd: 916.82 }),
  earnedThisMonth: ok({ usd: 635.39 }),
  pendleSplit: { realizedUsd: 895.05, markToMarketUsd: 21.77 }
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
  totalEarned: notAvailable('stusds-not-listed'),
  earnedThisMonth: notAvailable('stusds-not-listed')
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
    expect(position?.missingFromMonth).toEqual(['merkl']);
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
    expect(position?.pendleSplit).toEqual({ realizedUsd: 895.05, markToMarketUsd: 21.77 });
  });

  it('maps the savings row to the vaults.fyi figures', () => {
    const position = earningsForPosition(earnings, 'savings');
    expect(position?.totalEarned).toEqual(ok({ usd: 120.5, native: { amount: 118.2, symbol: 'sUSDS' } }));
  });

  it('returns notAvailable with the contributor reason when nothing is ok', () => {
    const position = earningsForPosition(earnings, 'stusds');
    expect(position?.totalEarned).toEqual(notAvailable('stusds-not-listed'));
    expect(position?.earnedThisMonth).toEqual(notAvailable('stusds-not-listed'));
    expect(position?.missingFromTotal).toEqual(['stusds']);
  });

  it('returns null for rows outside APP-450 scope', () => {
    expect(earningsForPosition(earnings, 'rewards-sky')).toBeNull();
    expect(earningsForPosition(earnings, 'vault-morpho-0xdeadbeef')).toBeNull();
  });
});
