import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { RewardsChartInfoParsed } from '@/hooks';

// Two stake farms; the chart-info arrays are swapped per test via this knob.
let mockChartInfo: (Partial<RewardsChartInfoParsed>[] | undefined)[] = [];

vi.mock('@/hooks', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks')>();
  return {
    ...actual,
    useStakeRewardContracts: () => ({
      data: [{ contractAddress: '0xfarmA' }, { contractAddress: '0xfarmB' }],
      isLoading: false
    }),
    useMultipleRewardsChartInfo: () => ({ data: mockChartInfo, isLoading: false, error: null })
  };
});

import { useStakeRewardsRate } from './useStakeRewardsRate';

const point = (blockTimestamp: number, rate: string) => ({ blockTimestamp, rate });

describe('useStakeRewardsRate', () => {
  it('crowns the farm with the highest most-recent rate and returns its full series', () => {
    // Farm A peaked at 0.20 in the past but its LATEST point (0.05) is what
    // competes; farm B's latest 0.08 wins.
    const farmA = [point(100, '0.20'), point(200, '0.05')];
    const farmB = [point(100, '0.01'), point(200, '0.08')];
    mockChartInfo = [farmA, farmB];

    const { result } = renderHook(() => useStakeRewardsRate());

    expect(result.current.currentRate).toBeCloseTo(0.08, 10);
    expect(result.current.series).toBe(farmB);
  });

  it('keeps the first farm on a tie (parity with useHighestRateFromChartData)', () => {
    const farmA = [point(200, '0.05')];
    const farmB = [point(200, '0.05')];
    mockChartInfo = [farmA, farmB];

    const { result } = renderHook(() => useStakeRewardsRate());

    expect(result.current.series).toBe(farmA);
  });

  it('skips empty and missing farm arrays', () => {
    const farmB = [point(200, '0.03')];
    mockChartInfo = [undefined, farmB];

    const { result } = renderHook(() => useStakeRewardsRate());

    expect(result.current.currentRate).toBeCloseTo(0.03, 10);
    expect(result.current.series).toBe(farmB);
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
});
