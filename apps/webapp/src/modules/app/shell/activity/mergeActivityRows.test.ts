import { describe, expect, it } from 'vitest';
import { mergeActivityRows, type ExtraActivityRow } from './mergeActivityRows';

const history = (...seconds: number[]) =>
  seconds.map(s => ({ blockTimestamp: new Date(s * 1000), transactionHash: `0x${s}` }));
const extra = (seconds: number): ExtraActivityRow => ({
  key: `extra-${seconds}`,
  timestamp: seconds * 1000,
  render: () => null
});
const times = (rows: ReturnType<typeof mergeActivityRows>) =>
  rows.map(row => (row.kind === 'history' ? row.item.blockTimestamp.getTime() : row.row.timestamp) / 1000);

describe('mergeActivityRows', () => {
  it('interleaves extra rows with the history, newest first', () => {
    const rows = mergeActivityRows(history(50, 30, 10), [extra(40), extra(60), extra(20)], true);
    expect(times(rows)).toEqual([60, 50, 40, 30, 20, 10]);
  });

  it('keeps each history row pointing at its index in the data (for its formatted date)', () => {
    const rows = mergeActivityRows(history(50, 30), [extra(40)], true);
    expect(rows.flatMap(row => (row.kind === 'history' ? [row.index] : []))).toEqual([0, 1]);
  });

  it('holds back extra rows older than the loaded history while older history is still on the server', () => {
    const rows = mergeActivityRows(history(50, 30), [extra(40), extra(20)], false);
    expect(times(rows)).toEqual([50, 40, 30]);
  });

  it('shows every extra row once the history is complete or when there is none', () => {
    expect(times(mergeActivityRows(history(50), [extra(20)], true))).toEqual([50, 20]);
    expect(times(mergeActivityRows([], [extra(20), extra(30)], false))).toEqual([30, 20]);
  });
});
