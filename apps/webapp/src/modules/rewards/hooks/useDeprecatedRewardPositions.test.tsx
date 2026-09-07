import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDeprecatedRewardPositions } from './useDeprecatedRewardPositions';

const SKY_FARM = '0x0650CAF159C5A49f711e8169D4336ECB9b950275' as `0x${string}`;
const SPK_FARM = '0x173e314C7635B45322cd8Cb14f44b312e079F3af' as `0x${string}`;

const hoisted = vi.hoisted(() => ({
  address: '0x1111111111111111111111111111111111111111' as `0x${string}` | undefined,
  balances: undefined as { result?: bigint }[] | undefined,
  isLoading: false,
  error: undefined as Error | undefined,
  geo: { rewardsEnabled: true, isLoading: false },
  readArgs: undefined as unknown
}));

vi.mock('@/hooks', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks')>();
  return {
    ...actual,
    useAvailableTokenRewardContracts: () => [
      {
        contractAddress: SKY_FARM,
        chainId: 1,
        supplyToken: { symbol: 'USDS' },
        rewardToken: { symbol: 'SKY' },
        name: 'Earn SKY'
      },
      {
        contractAddress: SPK_FARM,
        chainId: 1,
        supplyToken: { symbol: 'USDS' },
        rewardToken: { symbol: 'SPK' },
        name: 'Earn SPK'
      }
    ],
    isDeprecatedRewardContract: (address: string) => address.toLowerCase() === SKY_FARM.toLowerCase(),
    useMultipleRewardsChartInfo: ({ rewardContractAddresses }: { rewardContractAddresses: string[] }) => ({
      data: rewardContractAddresses.map(() => [{ totalSupplied: '9630000', rate: '0' }]),
      isLoading: false,
      error: null
    })
  };
});

vi.mock('wagmi', async importOriginal => {
  const actual = await importOriginal<typeof import('wagmi')>();
  return {
    ...actual,
    useChainId: () => 1,
    useConnection: () => ({ address: hoisted.address }),
    useReadContracts: (args: unknown) => {
      hoisted.readArgs = args;
      return { data: hoisted.balances, isLoading: hoisted.isLoading, error: hoisted.error };
    }
  };
});

vi.mock('@/modules/geo-config', () => ({
  useGeoConfig: () => ({
    isModuleEnabled: (module: string) => (module === 'rewards' ? hoisted.geo.rewardsEnabled : true),
    isLoading: hoisted.geo.isLoading
  })
}));

describe('useDeprecatedRewardPositions', () => {
  beforeEach(() => {
    hoisted.address = '0x1111111111111111111111111111111111111111';
    hoisted.balances = undefined;
    hoisted.isLoading = false;
    hoisted.error = undefined;
    hoisted.geo = { rewardsEnabled: true, isLoading: false };
  });

  it('reads balances for the deprecated farms only', () => {
    hoisted.balances = [{ result: 0n }];
    renderHook(() => useDeprecatedRewardPositions());
    const { contracts } = hoisted.readArgs as { contracts: { address: string }[] };
    expect(contracts.map(c => c.address)).toEqual([SKY_FARM]);
  });

  it('returns a position only for a deprecated farm with a balance', () => {
    hoisted.balances = [{ result: 15n * 10n ** 18n }];
    const { result } = renderHook(() => useDeprecatedRewardPositions());
    expect(result.current.positions).toHaveLength(1);
    expect(result.current.positions[0].contract.contractAddress).toBe(SKY_FARM);
    expect(result.current.positions[0].balance).toBe(15n * 10n ** 18n);
    // TVL rides along from the farm's BA Labs series (latest totalSupplied).
    expect(result.current.positions[0].tvlUsds).toBe(9630000);
    expect(result.current.isLoading).toBe(false);
  });

  it('returns nothing on a zero balance', () => {
    hoisted.balances = [{ result: 0n }];
    const { result } = renderHook(() => useDeprecatedRewardPositions());
    expect(result.current.positions).toEqual([]);
  });

  it('is loading while the balance read is unresolved, settled when disconnected', () => {
    hoisted.isLoading = true;
    expect(renderHook(() => useDeprecatedRewardPositions()).result.current.isLoading).toBe(true);

    hoisted.address = undefined;
    const { result } = renderHook(() => useDeprecatedRewardPositions());
    expect(result.current.isLoading).toBe(false);
    expect(result.current.positions).toEqual([]);
  });

  it('hides positions while the rewards module is geo-restricted, but not while the config loads', () => {
    hoisted.balances = [{ result: 1n }];
    hoisted.geo = { rewardsEnabled: false, isLoading: false };
    expect(renderHook(() => useDeprecatedRewardPositions()).result.current.positions).toEqual([]);

    hoisted.geo = { rewardsEnabled: false, isLoading: true };
    expect(renderHook(() => useDeprecatedRewardPositions()).result.current.positions).toHaveLength(1);
  });
});
