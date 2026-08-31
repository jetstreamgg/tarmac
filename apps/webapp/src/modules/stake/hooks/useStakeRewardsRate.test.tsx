import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RewardsChartInfoParsed } from '@/hooks';

// Two stake farms; the chart-info arrays are swapped per test via this knob.
let mockChartInfo: (Partial<RewardsChartInfoParsed>[] | undefined)[] | undefined = [];
// Both queries re-report loading whenever their key changes, so the tests can
// drive those flags independently of the data.
let mockContracts: { contractAddress: string }[] | undefined = [
  { contractAddress: '0xfarmA' },
  { contractAddress: '0xfarmB' }
];
let mockContractsLoading = false;
let mockChartsLoading = false;

vi.mock('@/hooks', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks')>();
  return {
    ...actual,
    useStakeRewardContracts: () => ({ data: mockContracts, isLoading: mockContractsLoading }),
    useMultipleRewardsChartInfo: () => ({
      data: mockChartInfo,
      isLoading: mockChartsLoading,
      error: null
    })
  };
});

import { useStakeRewardsRate } from './useStakeRewardsRate';

const point = (blockTimestamp: number, rate: string) => ({ blockTimestamp, rate });

describe('useStakeRewardsRate', () => {
  beforeEach(() => {
    mockContracts = [{ contractAddress: '0xfarmA' }, { contractAddress: '0xfarmB' }];
    mockContractsLoading = false;
    mockChartsLoading = false;
  });

  it('crowns the farm with the highest most-recent rate', () => {
    // Farm A peaked at 0.20 in the past but its LATEST point (0.05) is what
    // competes; farm B's latest 0.08 wins.
    const farmA = [point(100, '0.20'), point(200, '0.05')];
    const farmB = [point(100, '0.01'), point(200, '0.08')];
    mockChartInfo = [farmA, farmB];

    const { result } = renderHook(() => useStakeRewardsRate());

    expect(result.current.currentRate).toBeCloseTo(0.08, 10);
  });

  // APP-456 #5: plotting only today's winner truncated the chart at that farm's
  // launch, so `All` started later than `1Y` and later than the borrow-rate and
  // TVL series on the same card.
  it('plots the best rate available on each day, across all farms', () => {
    const farmA = [point(100, '0.20'), point(200, '0.05')];
    const farmB = [point(100, '0.01'), point(200, '0.08')];
    mockChartInfo = [farmA, farmB];

    const { result } = renderHook(() => useStakeRewardsRate());

    expect(result.current.series).toEqual([point(100, '0.20'), point(200, '0.08')]);
  });

  it('covers days that predate the currently winning farm', () => {
    const older = [point(100, '0.04'), point(200, '0.03'), point(300, '0.02')];
    const launchedLate = [point(300, '0.09')];
    mockChartInfo = [older, launchedLate];

    const { result } = renderHook(() => useStakeRewardsRate());

    expect(result.current.series.map(p => p.blockTimestamp)).toEqual([100, 200, 300]);
    // The newest point still agrees with the hero, by construction.
    expect(result.current.series.at(-1)?.rate).toBe('0.09');
    expect(result.current.currentRate).toBeCloseTo(0.09, 10);
  });

  it('sorts the merged series ascending regardless of fetch order', () => {
    mockChartInfo = [[point(300, '0.02'), point(100, '0.04')], [point(200, '0.03')]];

    const { result } = renderHook(() => useStakeRewardsRate());

    expect(result.current.series.map(p => p.blockTimestamp)).toEqual([100, 200, 300]);
  });

  it('keeps the first farm on a tie (parity with useHighestRateFromChartData)', () => {
    const farmA = [point(200, '0.05')];
    const farmB = [point(200, '0.05')];
    mockChartInfo = [farmA, farmB];

    const { result } = renderHook(() => useStakeRewardsRate());

    expect(result.current.series).toEqual(farmA);
  });

  it('skips empty and missing farm arrays', () => {
    const farmB = [point(200, '0.03')];
    mockChartInfo = [undefined, farmB];

    const { result } = renderHook(() => useStakeRewardsRate());

    expect(result.current.currentRate).toBeCloseTo(0.03, 10);
    expect(result.current.series).toEqual(farmB);
  });

  it('returns null and an empty series when no farm has data', () => {
    mockChartInfo = [[], undefined];

    const { result } = renderHook(() => useStakeRewardsRate());

    expect(result.current.currentRate).toBeNull();
    expect(result.current.series).toEqual([]);
  });

  it('returns a null rate when the winning rate does not parse', () => {
    mockChartInfo = [[point(200, 'not-a-number')]];

    const { result } = renderHook(() => useStakeRewardsRate());

    expect(result.current.currentRate).toBeNull();
  });

  it('reports loading on the cold start, before anything has resolved', () => {
    mockChartInfo = undefined;
    mockContracts = undefined;
    mockContractsLoading = true;

    const { result } = renderHook(() => useStakeRewardsRate());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.series).toEqual([]);
  });

  it('holds the resolved series instead of re-reporting loading when a query key changes', () => {
    // The contract list arrives as a hardcoded placeholder and the indexer's
    // real one replaces it, which rewrites the farm URLs the chart query is
    // keyed on: both queries hand back undefined and say "loading" a second
    // time. Passing that through returns the chart to its skeleton, and the
    // remount is what replays its entrance wipe.
    const farm = [point(100, '0.01'), point(200, '0.08')];
    mockChartInfo = [farm];

    const { result, rerender } = renderHook(() => useStakeRewardsRate());
    const held = result.current.series;
    expect(held).toEqual(farm);
    expect(result.current.isLoading).toBe(false);

    mockChartInfo = undefined;
    mockContracts = undefined;
    mockContractsLoading = true;
    mockChartsLoading = true;
    rerender();

    expect(result.current.isLoading).toBe(false);
    expect(result.current.series).toBe(held);
    expect(result.current.currentRate).toBeCloseTo(0.08, 10);
  });

  it('swaps to the new series once the refetch lands', () => {
    const first = [point(200, '0.08')];
    mockChartInfo = [first];
    const { result, rerender } = renderHook(() => useStakeRewardsRate());
    expect(result.current.series).toEqual(first);

    const second = [point(300, '0.12')];
    mockChartInfo = [second];
    rerender();

    expect(result.current.series).toEqual(second);
    expect(result.current.currentRate).toBeCloseTo(0.12, 10);
  });
});
