import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSuppliedBalancesTotalUsd } from './useSuppliedBalancesTotalUsd';

const mocks = vi.hoisted(() => {
  const ether = (n: number) => BigInt(n) * 10n ** 18n;
  return {
    ether,
    rewardsBalance: { data: ether(100), isLoading: false, error: null },
    staked: { data: ether(50), isLoading: false, error: null },
    stUsds: { data: { userSuppliedUsds: ether(10) }, isLoading: false, error: null },
    morpho: { data: { total: ether(20) }, isLoading: false, error: null },
    pendle: { data: { total: ether(5), totalUsd: 5 }, isLoading: false, error: null },
    savings: { data: { 1: ether(200), 8453: ether(100) }, isLoading: false, error: null },
    prices: {
      data: { USDS: { price: '1' }, SKY: { price: '0.1' } },
      isLoading: false
    }
  };
});

vi.mock('wagmi', async importOriginal => {
  const actual = await importOriginal<typeof import('wagmi')>();
  return {
    ...actual,
    useChainId: () => 1,
    useConnection: () => ({ address: '0x1234567890abcdef1234567890abcdef12345678' })
  };
});

vi.mock('@/hooks', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks')>();
  return {
    ...actual,
    useAvailableTokenRewardContracts: () => [
      {
        supplyToken: actual.TOKENS.usds,
        rewardToken: actual.TOKENS.sky,
        contractAddress: '0x0000000000000000000000000000000000000001'
      },
      {
        supplyToken: actual.TOKENS.usds,
        rewardToken: actual.TOKENS.cle,
        contractAddress: '0x0000000000000000000000000000000000000002'
      },
      {
        supplyToken: actual.TOKENS.usds,
        rewardToken: actual.TOKENS.spk,
        contractAddress: '0x0000000000000000000000000000000000000003'
      }
    ],
    useRewardsSuppliedBalance: () => mocks.rewardsBalance,
    useTotalUserStaked: () => mocks.staked,
    useStUsdsData: () => mocks.stUsds,
    useAllMorphoVaultsUserAssets: () => mocks.morpho,
    useAllPendleUserAssets: () => mocks.pendle,
    useMultiChainSavingsBalances: () => mocks.savings,
    usePrices: () => mocks.prices
  };
});

beforeEach(() => {
  mocks.prices = { data: { USDS: { price: '1' }, SKY: { price: '0.1' } }, isLoading: false };
  mocks.staked = { data: mocks.ether(50), isLoading: false, error: null };
});

describe('useSuppliedBalancesTotalUsd', () => {
  it('sums every supplied module to a USD total', () => {
    const { result } = renderHook(() => useSuppliedBalancesTotalUsd({ chainIds: [1, 8453] }));

    // rewards 3x100 USDS + savings 300 USDS + staked 50 SKY@0.1 + morpho 20 USDS + pendle $5 + stUSDS 10 USDS
    expect(result.current.totalUsd).toBe(300 + 300 + 5 + 20 + 5 + 10);
    expect(result.current.isLoading).toBe(false);
  });

  it('reports loading (no total yet) while any balance is still loading', () => {
    mocks.staked = { data: undefined as unknown as bigint, isLoading: true, error: null };
    const { result } = renderHook(() => useSuppliedBalancesTotalUsd({ chainIds: [1, 8453] }));

    expect(result.current.isLoading).toBe(true);
    expect(result.current.totalUsd).toBeUndefined();
  });
});
