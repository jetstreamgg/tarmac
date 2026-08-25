import { describe, expect, it } from 'vitest';
import { filterWalletEarnings } from './filterWalletEarnings';
import { notAvailable, ok, type ProtocolEarnings, type WalletEarnings } from './types';

const protocol = (
  id: ProtocolEarnings['id'],
  rowIds: string[],
  overrides: Partial<ProtocolEarnings> = {}
): ProtocolEarnings => ({
  id,
  rowIds,
  totalEarned: ok({ usd: 10 }),
  earnedThisMonth: ok({ usd: 1 }),
  isLoading: false,
  error: null,
  ...overrides
});

const wallet = (protocols: ProtocolEarnings[]): WalletEarnings => ({
  protocols,
  combined: {
    totalEarnedUsd: protocols.reduce(
      (acc, p) => acc + (p.totalEarned.status === 'ok' ? p.totalEarned.value.usd : 0),
      0
    ),
    earnedThisMonthUsd: protocols.reduce(
      (acc, p) => acc + (p.earnedThisMonth.status === 'ok' ? p.earnedThisMonth.value.usd : 0),
      0
    ),
    missingFromTotal: [],
    missingFromMonth: []
  },
  isLoading: protocols.some(p => p.isLoading),
  window: { startSec: 1785542400, endSec: 1788220799 }
});

describe('filterWalletEarnings', () => {
  it('drops sources whose rows are hidden and recombines the totals', () => {
    const earnings = wallet([
      protocol('savings', ['savings'], { totalEarned: ok({ usd: 46.4 }) }),
      protocol('stusds', ['stusds'], { totalEarned: ok({ usd: 30 }) }),
      protocol('pendle', ['fixed-0xaaa'], { totalEarned: ok({ usd: 916.82 }) })
    ]);

    const filtered = filterWalletEarnings(earnings, new Set(['stusds']));

    expect(filtered.protocols.map(p => p.id)).toEqual(['savings', 'pendle']);
    expect(filtered.combined.totalEarnedUsd).toBeCloseTo(46.4 + 916.82, 10);
  });

  it('removes a hidden source from the missing lists too — out of scope, not a data gap', () => {
    const earnings = wallet([
      protocol('savings', ['savings']),
      protocol('stusds', ['stusds'], {
        totalEarned: notAvailable('source-error'),
        earnedThisMonth: notAvailable('source-error')
      })
    ]);

    const filtered = filterWalletEarnings(earnings, new Set(['stusds']));

    expect(filtered.combined.missingFromTotal).toEqual([]);
    expect(filtered.combined.missingFromMonth).toEqual([]);
  });

  it('keeps sources whose rows are simply absent (matured Pendle market): only named rows hide', () => {
    const earnings = wallet([
      protocol('savings', ['savings']),
      protocol('pendle', ['fixed-0xmatured'], { totalEarned: ok({ usd: 916.82 }) })
    ]);

    // The matured market's row is delisted from the marketplace, so it can
    // never appear in a hidden set built as rows − visibleRows.
    const filtered = filterWalletEarnings(earnings, new Set(['stusds']));

    expect(filtered).toBe(earnings);
  });

  it('drops a multi-row source when any of its rows is hidden (module-level restriction)', () => {
    const earnings = wallet([
      protocol('pendle', ['fixed-0xaaa', 'fixed-0xbbb']),
      protocol('savings', ['savings'])
    ]);

    const filtered = filterWalletEarnings(earnings, new Set(['fixed-0xbbb']));

    expect(filtered.protocols.map(p => p.id)).toEqual(['savings']);
  });

  it('recomputes isLoading from the surviving sources only', () => {
    const earnings = wallet([
      protocol('savings', ['savings']),
      protocol('stusds', ['stusds'], { isLoading: true })
    ]);

    expect(earnings.isLoading).toBe(true);
    expect(filterWalletEarnings(earnings, new Set(['stusds'])).isLoading).toBe(false);
  });

  it('returns the same reference when nothing is hidden', () => {
    const earnings = wallet([protocol('savings', ['savings'])]);
    expect(filterWalletEarnings(earnings, new Set())).toBe(earnings);
    expect(filterWalletEarnings(earnings, new Set(['unrelated-row']))).toBe(earnings);
  });
});
