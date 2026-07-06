import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useRewardsSuppliersCount } from './useRewardsSuppliersCount';

// Suppliers data keyed by farm address. The mocks below serve this data through
// both chart-info hooks so the tests exercise behavior (total suppliers for a
// given set of farms) rather than which hook the implementation calls.
let suppliersByAddress: Record<string, number | undefined> = {};
let availableContracts: { contractAddress: string }[] = [];

const chartEntry = (address: string) => {
  const suppliers = suppliersByAddress[address.toLowerCase()];
  return suppliers === undefined ? [] : [{ suppliers }];
};

vi.mock('wagmi', async importOriginal => {
  const actual = await importOriginal<typeof import('wagmi')>();
  return {
    ...actual,
    useChainId: () => 1
  };
});

vi.mock('@/hooks', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks')>();
  return {
    ...actual,
    useAvailableTokenRewardContracts: () => availableContracts,
    useRewardsChartInfo: ({ rewardContractAddress }: { rewardContractAddress: string }) => ({
      data: chartEntry(rewardContractAddress),
      isLoading: false,
      error: undefined
    }),
    useMultipleRewardsChartInfo: ({ rewardContractAddresses }: { rewardContractAddresses: string[] }) => ({
      data: rewardContractAddresses.map(chartEntry),
      isLoading: false,
      error: undefined
    })
  };
});

const SKY_FARM = '0xaaa1';
const SPK_FARM = '0xaaa2';
const GROVE_FARM = '0xaaa3';
const CLE_FARM = '0xaaa4';

describe('useRewardsSuppliersCount', () => {
  beforeEach(() => {
    suppliersByAddress = {};
    availableContracts = [];
  });

  // Characterization of the behavior shipped on development (three farms):
  // the pre-Grove implementation and the loop-based one must agree here.
  describe('with three farms (pre-Grove production configuration)', () => {
    it('sums suppliers across all three farms', () => {
      availableContracts = [SKY_FARM, SPK_FARM, CLE_FARM].map(contractAddress => ({ contractAddress }));
      suppliersByAddress = { [SKY_FARM]: 503, [SPK_FARM]: 330, [CLE_FARM]: 1715 };

      const { result } = renderHook(() => useRewardsSuppliersCount());

      expect(result.current.data).toBe(503 + 330 + 1715);
    });

    it('treats farms without chart data as zero suppliers', () => {
      availableContracts = [SKY_FARM, SPK_FARM, CLE_FARM].map(contractAddress => ({ contractAddress }));
      suppliersByAddress = { [SKY_FARM]: 503, [CLE_FARM]: 1715 };

      const { result } = renderHook(() => useRewardsSuppliersCount());

      expect(result.current.data).toBe(503 + 1715);
    });
  });

  // Regression test for the Grove launch: the hardcoded three-farm destructure
  // dropped the fourth farm (Chronicle) from the total.
  describe('with four farms (Grove added)', () => {
    it('sums suppliers across all four farms', () => {
      availableContracts = [SKY_FARM, SPK_FARM, GROVE_FARM, CLE_FARM].map(contractAddress => ({
        contractAddress
      }));
      suppliersByAddress = { [SKY_FARM]: 503, [SPK_FARM]: 330, [GROVE_FARM]: 1, [CLE_FARM]: 1715 };

      const { result } = renderHook(() => useRewardsSuppliersCount());

      expect(result.current.data).toBe(503 + 330 + 1 + 1715);
    });
  });
});
