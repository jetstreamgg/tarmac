import { describe, expect, it } from 'vitest';
import { blockRanges } from './blockRanges';

const ranges = (...args: Parameters<typeof blockRanges>) =>
  [...blockRanges(...args)].map(({ fromBlock, toBlock }) => [fromBlock, toBlock]);

describe('blockRanges', () => {
  it('covers every block once, oldest first, with a short last range', () => {
    expect(ranges(0n, 24n, 10n)).toEqual([
      [0n, 9n],
      [10n, 19n],
      [20n, 24n]
    ]);
  });

  it('covers every block once, newest first, with a short oldest range', () => {
    expect(ranges(0n, 24n, 10n, { newestFirst: true })).toEqual([
      [15n, 24n],
      [5n, 14n],
      [0n, 4n]
    ]);
  });

  it('ends on the last block when the span is a whole number of ranges', () => {
    expect(ranges(1n, 20n, 10n)).toEqual([
      [1n, 10n],
      [11n, 20n]
    ]);
    expect(ranges(1n, 20n, 10n, { newestFirst: true })).toEqual([
      [11n, 20n],
      [1n, 10n]
    ]);
  });

  it('gives one range for a single block, and none for an empty span', () => {
    expect(ranges(7n, 7n, 10n)).toEqual([[7n, 7n]]);
    expect(ranges(7n, 7n, 10n, { newestFirst: true })).toEqual([[7n, 7n]]);
    expect(ranges(8n, 7n, 10n)).toEqual([]);
    expect(ranges(8n, 7n, 10n, { newestFirst: true })).toEqual([]);
  });
});
