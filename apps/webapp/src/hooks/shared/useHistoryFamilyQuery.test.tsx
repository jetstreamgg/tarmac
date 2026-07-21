/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { ModuleEnum } from '../constants';
import { TOKENS } from '../tokens/tokens.constants';
import { chainId as chainIdMap } from '@/utils';

// Reconstruct the interpolated query string so assertions can inspect it.
vi.mock('graphql-request', () => ({
  request: vi.fn(),
  gql: (strings: TemplateStringsArray, ...values: unknown[]) =>
    strings.reduce((acc, str, i) => acc + str + (i < values.length ? String(values[i]) : ''), '')
}));

vi.mock('wagmi', () => ({
  useConnection: vi.fn(),
  useChainId: vi.fn()
}));

vi.mock('../rewards/useAvailableTokenRewardContracts', () => ({
  useAvailableTokenRewardContracts: vi.fn()
}));

import { request } from 'graphql-request';
import { useConnection, useChainId } from 'wagmi';
import { useAvailableTokenRewardContracts } from '../rewards/useAvailableTokenRewardContracts';
import { useHistoryFamilyQuery } from './useHistoryFamilyQuery';

const USER = '0x1111111111111111111111111111111111111111';

const STAKE_RESPONSE = {
  stakingOpens: [{ index: '0', blockTimestamp: '1700000100', transactionHash: '0xopen' }],
  stakingSelectVoteDelegates: [],
  stakingSelectRewards: [],
  stakingLocks: [{ index: '0', wad: '50', blockTimestamp: '1700000200', transactionHash: '0xlock' }],
  stakingFrees: [],
  stakingDraws: [],
  stakingWipes: [],
  stakingGetRewards: [],
  stakingOnKicks: []
};

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe('useHistoryFamilyQuery — filter-scoped history documents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useConnection).mockReturnValue({ address: USER } as unknown as ReturnType<
      typeof useConnection
    >);
    vi.mocked(useChainId).mockReturnValue(1);
    vi.mocked(useAvailableTokenRewardContracts).mockReturnValue(
      [] as unknown as ReturnType<typeof useAvailableTokenRewardContracts>
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches a mainnet family on its own — the sparse-category fix', () => {
    vi.mocked(request).mockResolvedValueOnce(STAKE_RESPONSE);

    const { result } = renderHook(() => useHistoryFamilyQuery({ family: 'stake' }), {
      wrapper: makeWrapper()
    });

    return waitFor(() => expect(result.current.data).toBeDefined()).then(() => {
      expect(request).toHaveBeenCalledTimes(1);
      const query = vi.mocked(request).mock.calls[0][1] as string;
      expect(query).toContain('stakingOpens: StakingOpen');
      // Only the stake family is in the document — its pages advance at the
      // family's own density, never clamped by a denser family.
      expect(query).not.toContain('SavingsSupply');
      expect(query).not.toContain('swaps_');
      expect(result.current.data).toHaveLength(2);
      expect(result.current.data![0].module).toBe(ModuleEnum.STAKE);
      expect(result.current.hasNextPage).toBe(false);
    });
  });

  it('returns empty without fetching when the family has no scope on the network', () => {
    const { result } = renderHook(
      () => useHistoryFamilyQuery({ family: 'stake', chainId: chainIdMap.base }),
      { wrapper: makeWrapper() }
    );

    expect(request).not.toHaveBeenCalled();
    expect(result.current.data).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it('spans both indexer legs for savings (mainnet + all L2s)', async () => {
    vi.mocked(request).mockImplementation(((url: string) => {
      if (url.endsWith('/1')) {
        return Promise.resolve({
          savingsSupplies: [{ assets: '100', blockTimestamp: '1700000300', transactionHash: '0xeth' }],
          savingsWithdraws: []
        });
      }
      const response: Record<string, unknown[]> = {};
      for (const chainId of [8453, 42161, 10, 130]) {
        response[`usdsIn_${chainId}`] = [];
        response[`usdsOut_${chainId}`] = [];
      }
      response['usdsOut_8453'] = [
        {
          transactionHash: '0xbase',
          assetIn: TOKENS.usds.address[8453],
          assetOut: TOKENS.susds.address[8453],
          sender: USER,
          amountIn: '1000',
          amountOut: '999',
          blockTimestamp: '1700000200'
        }
      ];
      return Promise.resolve(response);
    }) as typeof request);

    const { result } = renderHook(() => useHistoryFamilyQuery({ family: 'savings' }), {
      wrapper: makeWrapper()
    });

    await waitFor(() => expect(result.current.data).toBeDefined());
    // Mainnet and L2 data live in different databases in dev mode → two legs.
    expect(request).toHaveBeenCalledTimes(2);
    expect(result.current.data).toHaveLength(2);
    expect(result.current.data![0].chainId).toBe(1);
    expect(result.current.data![1].chainId).toBe(8453);
    expect(result.current.data!.every(item => item.module === ModuleEnum.SAVINGS)).toBe(true);
  });

  it('narrows the savings legs to one L2 when a network is set', async () => {
    vi.mocked(request).mockResolvedValueOnce({ usdsIn_8453: [], usdsOut_8453: [] });

    const { result } = renderHook(
      () => useHistoryFamilyQuery({ family: 'savings', chainId: chainIdMap.base }),
      { wrapper: makeWrapper() }
    );

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(request).toHaveBeenCalledTimes(1);
    const query = vi.mocked(request).mock.calls[0][1] as string;
    expect(query).toContain('usdsIn_8453: Swap');
    expect(query).not.toContain('usdsIn_42161');
    expect(query).not.toContain('SavingsSupply');
  });
});
