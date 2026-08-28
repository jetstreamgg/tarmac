import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EarnProductRow } from '@/hooks';
import { Intent } from '@/lib/enums';
import { useEarnWithSkyProducts } from './useEarnWithSkyProducts';

const h = vi.hoisted(() => ({
  geo: { isLoading: false, isModuleEnabled: vi.fn(() => true) },
  contracts: { data: [{ contractAddress: '0xfarm' }], isLoading: false },
  charts: { data: [[{ blockTimestamp: 1, rate: '0.105' }]], isLoading: false }
}));

vi.mock('@/hooks', () => ({
  useStakeRewardContracts: () => h.contracts,
  useMultipleRewardsChartInfo: () => h.charts,
  useHighestRateFromChartData: (charts: { rate: string }[][]) => charts[0]?.[0] ?? null
}));
vi.mock('@/modules/geo-config', () => ({ useGeoConfig: () => h.geo }));

const savings: EarnProductRow = {
  id: 'savings',
  kind: 'savings',
  riskProfile: 'savings',
  intent: Intent.SAVINGS_INTENT,
  name: 'Sky Savings Rate',
  tokenSymbol: 'sUSDS',
  supplyTokens: ['USDS'],
  risk: 'low',
  networks: [1],
  detailPath: '/earn/savings',
  rate: { value: 0.0375, formatted: '3.75%' },
  rate30d: { formatted: '—' },
  isLoading: false,
  error: null
};

describe('useEarnWithSkyProducts', () => {
  beforeEach(() => {
    h.geo = { isLoading: false, isModuleEnabled: vi.fn(() => true) };
    h.contracts = { data: [{ contractAddress: '0xfarm' }], isLoading: false };
    h.charts = { data: [[{ blockTimestamp: 1, rate: '0.105' }]], isLoading: false };
  });

  it('adds a Stake card carrying the highest stake reward rate', () => {
    const { result } = renderHook(() => useEarnWithSkyProducts([savings]));

    expect(result.current.map(p => p.id)).toEqual(['savings', 'stake']);
    expect(result.current[1].rate).toEqual({ value: 0.105, formatted: '10.50%' });
    expect(result.current[1].isLoading).toBe(false);
  });

  it('leaves the Stake rate unknown (badge hidden) while its sources load', () => {
    h.charts = { data: undefined as never, isLoading: true };

    const { result } = renderHook(() => useEarnWithSkyProducts([savings]));

    expect(result.current[1].rate.value).toBeUndefined();
    expect(result.current[1].isLoading).toBe(true);
  });

  it('drops the Stake card when the region restricts the stake module', () => {
    h.geo = { isLoading: false, isModuleEnabled: vi.fn(() => false) };

    const { result } = renderHook(() => useEarnWithSkyProducts([savings]));

    expect(result.current.map(p => p.id)).toEqual(['savings']);
  });

  it('keeps the Stake card while the geo config is still loading', () => {
    h.geo = { isLoading: true, isModuleEnabled: vi.fn(() => false) };

    const { result } = renderHook(() => useEarnWithSkyProducts([savings]));

    expect(result.current.map(p => p.id)).toEqual(['savings', 'stake']);
  });
});
