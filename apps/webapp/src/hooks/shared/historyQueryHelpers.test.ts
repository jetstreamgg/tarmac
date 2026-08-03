import { describe, expect, it } from 'vitest';
import { HISTORY_QUERY_LIMIT } from '../constants';
import {
  historyQueryArgs,
  collectHistoryLists,
  historyPageBoundary,
  clampHistoryPage
} from './historyQueryHelpers';

const rows = (timestamps: number[]) => timestamps.map(t => ({ blockTimestamp: String(t) }));

/** A full list: HISTORY_QUERY_LIMIT rows descending from `newest`, ending at `oldest`. */
const fullList = (newest: number, oldest: number) => {
  const list = rows(Array.from({ length: HISTORY_QUERY_LIMIT - 1 }, (_, i) => newest - i));
  list.push({ blockTimestamp: String(oldest) });
  return list;
};

describe('historyQueryArgs', () => {
  it('emits bounded, newest-first args', () => {
    const args = historyQueryArgs('owner: { _eq: "0xabc" }');
    expect(args).toBe(
      `(where: { owner: { _eq: "0xabc" } }, order_by: { blockTimestamp: desc }, limit: ${HISTORY_QUERY_LIMIT})`
    );
  });

  it('appends the keyset cursor when given', () => {
    const args = historyQueryArgs('owner: { _eq: "0xabc" }', 1700000000);
    expect(args).toContain('blockTimestamp: { _lt: "1700000000" }');
  });
});

describe('collectHistoryLists', () => {
  it('collects top-level and nested row lists, skipping non-row arrays', () => {
    const response = {
      savingsSupplies: rows([3, 2, 1]),
      empty: [],
      rewards: [
        { address: '0x1', supplyInstances: rows([5, 4]), withdrawals: [], rewardClaims: rows([9]) },
        { address: '0x2', supplyInstances: rows([7]), withdrawals: rows([6]), rewardClaims: [] }
      ]
    };
    const lists = collectHistoryLists(response);
    expect(lists).toHaveLength(5);
    expect(lists.map(list => list.length).sort()).toEqual([1, 1, 1, 2, 3]);
  });
});

describe('historyPageBoundary', () => {
  it('is undefined when no list hits the limit (final page)', () => {
    expect(historyPageBoundary({ a: rows([3, 2, 1]), b: [] })).toBeUndefined();
  });

  it('is the newest frontier among full lists', () => {
    const response = {
      // Full down to 500 → frontier 500.
      dense: fullList(10_000, 500),
      // Full down to 900 → frontier 900 (the newest ⇒ the boundary).
      denser: fullList(10_000, 900),
      // Short list constrains nothing.
      sparse: rows([9_000, 100])
    };
    expect(historyPageBoundary(response)).toBe(900);
  });

  it('sees nested full lists', () => {
    const response = {
      rewards: [{ address: '0x1', supplyInstances: fullList(10_000, 700) }]
    };
    expect(historyPageBoundary(response)).toBe(700);
  });
});

describe('clampHistoryPage', () => {
  const items = [5_000, 900, 899, 100].map(t => ({ blockTimestamp: new Date(t * 1000) }));

  it('keeps only items at or above the boundary', () => {
    expect(clampHistoryPage(items, 900).map(i => i.blockTimestamp.getTime() / 1000)).toEqual([5_000, 900]);
  });

  it('keeps everything when there is no boundary', () => {
    expect(clampHistoryPage(items, undefined)).toHaveLength(4);
  });
});
