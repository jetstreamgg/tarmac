import { describe, expect, it } from 'vitest';
import { combineWalletEarnings } from './combineWalletEarnings';
import { notAvailable, ok, type ProtocolEarnings } from './types';

const protocol = (overrides: Partial<ProtocolEarnings> & Pick<ProtocolEarnings, 'id'>): ProtocolEarnings => ({
  rowIds: [],
  totalEarned: notAvailable('source-error'),
  earnedThisMonth: notAvailable('source-error'),
  isLoading: false,
  error: null,
  ...overrides
});

// Hand-picked figures; expected sums written as visible arithmetic.
const morpho = protocol({
  id: 'morpho-vault-0xflagship',
  totalEarned: ok({ usd: 875.06, native: { amount: 875.06, symbol: 'USDS' } }),
  earnedThisMonth: ok({ usd: 75.11, native: { amount: 75.11, symbol: 'USDS' } })
});
const merkl = protocol({
  id: 'merkl',
  totalEarned: ok({ usd: 8456.48, byToken: [{ amount: 8456.48, symbol: 'USDS' }] }),
  earnedThisMonth: notAvailable('merkl-monthly-unsupported')
});
const pendle = protocol({
  id: 'pendle',
  totalEarned: ok({ usd: 916.82 }),
  earnedThisMonth: ok({ usd: 635.39 }),
  pendleSplit: { realizedUsd: 895.05, markToMarketUsd: 21.77 }
});

describe('combineWalletEarnings', () => {
  it('sums only ok figures and flags notAvailable sources per window', () => {
    const combined = combineWalletEarnings([morpho, merkl, pendle]);
    expect(combined.totalEarnedUsd).toBeCloseTo(875.06 + 8456.48 + 916.82, 10);
    expect(combined.earnedThisMonthUsd).toBeCloseTo(75.11 + 635.39, 10);
    expect(combined.missingFromTotal).toEqual([]);
    expect(combined.missingFromMonth).toEqual(['merkl']);
  });

  it('flags an errored source in both windows without sinking the rest', () => {
    const broken = protocol({
      id: 'savings',
      totalEarned: notAvailable('source-error'),
      earnedThisMonth: notAvailable('source-error'),
      error: new Error('boom')
    });
    const combined = combineWalletEarnings([morpho, broken]);
    expect(combined.totalEarnedUsd).toBeCloseTo(875.06, 10);
    expect(combined.earnedThisMonthUsd).toBeCloseTo(75.11, 10);
    expect(combined.missingFromTotal).toEqual(['savings']);
    expect(combined.missingFromMonth).toEqual(['savings']);
  });

  it('reports zero sums with every source missing when nothing is ok', () => {
    const stusds = protocol({
      id: 'stusds',
      totalEarned: notAvailable('stusds-not-listed'),
      earnedThisMonth: notAvailable('stusds-not-listed')
    });
    const combined = combineWalletEarnings([stusds, protocol({ id: 'savings' })]);
    expect(combined.totalEarnedUsd).toBe(0);
    expect(combined.earnedThisMonthUsd).toBe(0);
    // UI can detect "nothing known" (dash, not $0): missing === all sources.
    expect(combined.missingFromTotal).toEqual(['stusds', 'savings']);
    expect(combined.missingFromMonth).toEqual(['stusds', 'savings']);
  });

  it('preserves protocol order in the missing lists', () => {
    const combined = combineWalletEarnings([pendle, merkl, morpho]);
    expect(combined.missingFromMonth).toEqual(['merkl']);
  });

  it('sums negative figures signed (Pendle MTM can be negative)', () => {
    const losing = protocol({
      id: 'pendle',
      totalEarned: ok({ usd: -2998.4 }),
      earnedThisMonth: ok({ usd: -12.5 })
    });
    const combined = combineWalletEarnings([morpho, losing]);
    expect(combined.totalEarnedUsd).toBeCloseTo(875.06 - 2998.4, 10);
    expect(combined.earnedThisMonthUsd).toBeCloseTo(75.11 - 12.5, 10);
  });

  it('returns an empty combined view for an empty protocol list', () => {
    expect(combineWalletEarnings([])).toEqual({
      totalEarnedUsd: 0,
      earnedThisMonthUsd: 0,
      missingFromTotal: [],
      missingFromMonth: []
    });
  });
});
