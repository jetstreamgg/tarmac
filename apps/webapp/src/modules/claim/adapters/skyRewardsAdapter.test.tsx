import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ClaimableReward } from '../types';

const USER = '0x1111111111111111111111111111111111111111';
const CONTRACT_A = '0xAAaA000000000000000000000000000000000001';
const CONTRACT_B = '0xBbBb000000000000000000000000000000000002';

type ToClaim = { contractAddress: string; claimBalance: bigint; rewardSymbol: string };

const h = vi.hoisted(() => ({
  contracts: [] as { contractAddress: string; rewardToken: { symbol: string; decimals: number } }[],
  toClaim: undefined as ToClaim[] | undefined,
  prices: {} as Record<string, { price: string }>,
  address: undefined as string | undefined
}));

vi.mock('wagmi', () => ({
  useChainId: () => 1,
  useConnection: () => ({ address: h.address })
}));

vi.mock('@/hooks', () => ({
  useAvailableTokenRewardContracts: () => h.contracts,
  useRewardContractsToClaim: () => ({ data: h.toClaim, isLoading: false }),
  usePrices: () => ({ data: h.prices }),
  getTokenDecimals: () => 18,
  // Real getWriteContractCall is an identity cast — mirror it so the test sees the args.
  getWriteContractCall: (params: unknown) => params
}));

vi.mock('@/modules/ui/components/TokenIcon', () => ({ TokenIcon: () => null }));

import { skyRewardsAdapter } from './skyRewardsAdapter';

const seedContracts = () => {
  h.contracts = [
    { contractAddress: CONTRACT_A, rewardToken: { symbol: 'SKY', decimals: 18 } },
    { contractAddress: CONTRACT_B, rewardToken: { symbol: 'SPK', decimals: 18 } }
  ];
  h.toClaim = [
    { contractAddress: CONTRACT_A, claimBalance: 2n * 10n ** 18n, rewardSymbol: 'SKY' },
    { contractAddress: CONTRACT_B, claimBalance: 5n * 10n ** 18n, rewardSymbol: 'SPK' }
  ];
  h.prices = { SKY: { price: '0.05' }, SPK: { price: '0.10' } };
};

const skySelection = (addresses: string[]): ClaimableReward[] =>
  addresses.map(address => ({
    id: address,
    source: 'sky-rewards',
    sourceLabel: 'Sky Rewards',
    tokenSymbol: 'SKY',
    icon: null,
    formattedAmount: '',
    amountUsd: 0,
    chainId: 1
  }));

describe('skyRewardsAdapter', () => {
  it('is the sky-rewards source', () => {
    expect(skyRewardsAdapter.source).toBe('sky-rewards');
  });

  describe('useClaimable', () => {
    it('normalizes each earned contract into a ClaimableReward for scope=all', () => {
      seedContracts();
      const { result } = renderHook(() => skyRewardsAdapter.useClaimable({ kind: 'all' }));

      expect(result.current.rewards).toHaveLength(2);
      expect(result.current.rewards[0]).toMatchObject({
        id: CONTRACT_A,
        source: 'sky-rewards',
        sourceLabel: 'Sky Rewards',
        tokenSymbol: 'SKY',
        chainId: 1
      });
      // 2 SKY × $0.05 = $0.10.
      expect(result.current.rewards[0].amountUsd).toBeCloseTo(0.1);
      expect(result.current.rewards[1].tokenSymbol).toBe('SPK');
    });

    it('falls back to 0 USD when the reward token has no price', () => {
      seedContracts();
      h.prices = {};
      const { result } = renderHook(() => skyRewardsAdapter.useClaimable({ kind: 'all' }));

      expect(result.current.rewards[0].amountUsd).toBe(0);
    });

    it('filters to the scoped contract for scope=reward-contract (case-insensitive)', () => {
      seedContracts();
      const { result } = renderHook(() =>
        skyRewardsAdapter.useClaimable({
          kind: 'reward-contract',
          address: CONTRACT_B.toLowerCase() as `0x${string}`
        })
      );

      expect(result.current.rewards.map(r => r.id)).toEqual([CONTRACT_B]);
    });

    it('contributes nothing to vault or stake scopes', () => {
      seedContracts();
      const vault = renderHook(() =>
        skyRewardsAdapter.useClaimable({ kind: 'vault', vaultAddress: '0xvault' })
      );
      const stake = renderHook(() => skyRewardsAdapter.useClaimable({ kind: 'stake', index: 0n }));

      expect(vault.result.current.rewards).toEqual([]);
      expect(stake.result.current.rewards).toEqual([]);
    });
  });

  describe('useClaimCalls', () => {
    it('builds one no-arg getReward call per selected contract', () => {
      h.address = USER;
      const { result } = renderHook(() =>
        skyRewardsAdapter.useClaimCalls(skySelection([CONTRACT_A, CONTRACT_B]))
      );

      expect(result.current.prepared).toBe(true);
      expect(result.current.calls).toHaveLength(2);
      const calls = result.current.calls as unknown as {
        to: string;
        functionName: string;
        args: unknown[];
      }[];
      expect(calls.map(c => c.to)).toEqual([CONTRACT_A, CONTRACT_B]);
      expect(calls.every(c => c.functionName === 'getReward')).toBe(true);
      expect(calls.every(c => Array.isArray(c.args) && c.args.length === 0)).toBe(true);
    });

    it('ignores selections from other sources', () => {
      h.address = USER;
      const mixed: ClaimableReward[] = [
        ...skySelection([CONTRACT_A]),
        {
          id: '0xmerkltoken',
          source: 'merkl',
          sourceLabel: 'Merkl',
          tokenSymbol: 'MORPHO',
          icon: null,
          formattedAmount: '1',
          amountUsd: 1,
          chainId: 1
        }
      ];
      const { result } = renderHook(() => skyRewardsAdapter.useClaimCalls(mixed));

      expect(result.current.calls).toHaveLength(1);
      expect((result.current.calls[0] as unknown as { to: string }).to).toBe(CONTRACT_A);
    });

    it('is unprepared with no selection or no wallet', () => {
      h.address = USER;
      expect(renderHook(() => skyRewardsAdapter.useClaimCalls([])).result.current).toEqual({
        calls: [],
        prepared: false
      });

      h.address = undefined;
      expect(
        renderHook(() => skyRewardsAdapter.useClaimCalls(skySelection([CONTRACT_A]))).result.current
      ).toEqual({ calls: [], prepared: false });
    });
  });
});
