import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ClaimableReward } from '../types';

type UrnReward = { contractAddress: string; claimBalance: bigint; rewardSymbol: string };

// Addresses the mock factories return must be hoisted (vi.mock lifts above module consts).
const h = vi.hoisted(() => ({
  USER: '0x1111111111111111111111111111111111111111',
  URN: '0x2222222222222222222222222222222222222222',
  STAKE_MODULE: '0x3333333333333333333333333333333333333333',
  SKY_REWARD: '0x5555555555555555555555555555555555555555',
  SPK_REWARD: '0x6666666666666666666666666666666666666666',
  urnRewards: [] as UrnReward[],
  prices: {} as Record<string, { price: string }>,
  address: undefined as string | undefined
}));

const { USER, STAKE_MODULE, SKY_REWARD, SPK_REWARD } = h;

vi.mock('wagmi', () => ({
  useChainId: () => 1,
  useConnection: () => ({ address: h.address })
}));

vi.mock('@/hooks', () => ({
  useStakeUrnAddress: () => ({ data: h.URN }),
  useStakeRewardContracts: () => ({
    data: [{ contractAddress: h.SKY_REWARD }, { contractAddress: h.SPK_REWARD }]
  }),
  useRewardContractsToClaim: () => ({ data: h.urnRewards, isLoading: false }),
  usePrices: () => ({ data: h.prices }),
  getWriteContractCall: (params: unknown) => params,
  stakeModuleAddress: { 1: h.STAKE_MODULE },
  stakeModuleAbi: [],
  ZERO_ADDRESS: '0x0000000000000000000000000000000000000000'
}));

vi.mock('@/modules/ui/components/TokenIcon', () => ({ TokenIcon: () => null }));

import { stakeAdapter } from './stakeAdapter';

type BuiltCall = { to: string; functionName: string; args: unknown[] };
const asCalls = (calls: unknown[]) => calls as unknown as BuiltCall[];

const stakeSelection = (index: bigint, contracts: string[]): ClaimableReward[] =>
  contracts.map(contract => ({
    id: `${index}:${contract.toLowerCase()}`,
    source: 'stake',
    tokenName: 'Sky token',
    tokenSymbol: 'SKY',
    icon: null,
    formattedAmount: '',
    amount: 0,
    amountUsd: 0,
    chainId: 1
  }));

const seed = () => {
  h.urnRewards = [
    { contractAddress: SKY_REWARD, claimBalance: 3n * 10n ** 18n, rewardSymbol: 'SKY' },
    { contractAddress: SPK_REWARD, claimBalance: 7n * 10n ** 18n, rewardSymbol: 'SPK' }
  ];
  h.prices = { SKY: { price: '0.05' }, SPK: { price: '0.10' } };
  h.address = USER;
};

describe('stakeAdapter', () => {
  it('is the stake source', () => {
    expect(stakeAdapter.source).toBe('stake');
  });

  describe('useClaimable', () => {
    it('maps a urn’s rewards, keyed by urnIndex:rewardContract', () => {
      seed();
      const { result } = renderHook(() => stakeAdapter.useClaimable({ kind: 'stake', index: 0n }));

      expect(result.current.rewards).toHaveLength(2);
      expect(result.current.rewards[0]).toMatchObject({
        id: `0:${SKY_REWARD.toLowerCase()}`,
        source: 'stake',
        tokenName: 'Sky token',
        tokenSymbol: 'SKY',
        chainId: 1
      });
      // 3 SKY × $0.05 = $0.15.
      expect(result.current.rewards[0].amountUsd).toBeCloseTo(0.15);
    });

    it('contributes nothing to non-stake scopes', () => {
      seed();
      const all = renderHook(() => stakeAdapter.useClaimable({ kind: 'all' }));
      const vault = renderHook(() => stakeAdapter.useClaimable({ kind: 'vault', vaultAddress: '0xvault' }));
      const rewardContract = renderHook(() =>
        stakeAdapter.useClaimable({ kind: 'reward-contract', address: '0xcontract' })
      );

      expect(all.result.current.rewards).toEqual([]);
      expect(vault.result.current.rewards).toEqual([]);
      expect(rewardContract.result.current.rewards).toEqual([]);
    });

    it('returns referentially stable rewards across re-renders (loop guard)', () => {
      // A fresh array each render would bust the panel's merged-rewards memo
      // chain and loop its modal-content sync effect ("Maximum update depth").
      seed();
      const scoped = renderHook(() => stakeAdapter.useClaimable({ kind: 'reward-contract', address: '0xc' }));
      const first = scoped.result.current.rewards;
      scoped.rerender();
      expect(scoped.result.current.rewards).toBe(first);

      const stake = renderHook(() => stakeAdapter.useClaimable({ kind: 'stake', index: 0n }));
      const firstStake = stake.result.current.rewards;
      stake.rerender();
      expect(stake.result.current.rewards).toBe(firstStake);
    });
  });

  describe('useClaimCalls', () => {
    it('builds one getReward(owner,index,contract,owner) per selected contract', () => {
      seed();
      const { result } = renderHook(() =>
        stakeAdapter.useClaimCalls(stakeSelection(0n, [SKY_REWARD, SPK_REWARD]))
      );

      expect(result.current.prepared).toBe(true);
      const calls = asCalls(result.current.calls);
      expect(calls).toHaveLength(2);
      expect(calls.every(c => c.to === STAKE_MODULE && c.functionName === 'getReward')).toBe(true);
      expect(calls[0].args).toEqual([USER, 0n, SKY_REWARD.toLowerCase(), USER]);
      expect(calls[1].args).toEqual([USER, 0n, SPK_REWARD.toLowerCase(), USER]);
    });

    it('ignores selections from other sources', () => {
      seed();
      const mixed: ClaimableReward[] = [
        ...stakeSelection(0n, [SKY_REWARD]),
        {
          id: '0xmerkltoken',
          source: 'merkl',
          tokenName: 'Morpho token',
          tokenSymbol: 'MORPHO',
          icon: null,
          formattedAmount: '1',
          amount: 1,
          amountUsd: 1,
          chainId: 1
        }
      ];
      const { result } = renderHook(() => stakeAdapter.useClaimCalls(mixed));
      expect(result.current.calls).toHaveLength(1);
    });

    it('is unprepared with no selection or no wallet', () => {
      seed();
      expect(renderHook(() => stakeAdapter.useClaimCalls([])).result.current).toEqual({
        calls: [],
        prepared: false
      });

      h.address = undefined;
      expect(
        renderHook(() => stakeAdapter.useClaimCalls(stakeSelection(0n, [SKY_REWARD]))).result.current
      ).toEqual({ calls: [], prepared: false });
    });

    it('only ever builds getReward — no approve or lock, even for a single-urn SKY selection', () => {
      seed();
      const { result } = renderHook(() =>
        stakeAdapter.useClaimCalls(stakeSelection(0n, [SKY_REWARD, SPK_REWARD]))
      );

      expect(asCalls(result.current.calls).map(c => c.functionName)).toEqual(['getReward', 'getReward']);
    });

    it('claims a selection spanning urns, one getReward per urn', () => {
      seed();
      const { result } = renderHook(() =>
        stakeAdapter.useClaimCalls([...stakeSelection(0n, [SKY_REWARD]), ...stakeSelection(3n, [SKY_REWARD])])
      );

      const calls = asCalls(result.current.calls);
      expect(calls.map(c => c.functionName)).toEqual(['getReward', 'getReward']);
      expect(calls[0].args).toEqual([USER, 0n, SKY_REWARD.toLowerCase(), USER]);
      expect(calls[1].args).toEqual([USER, 3n, SKY_REWARD.toLowerCase(), USER]);
    });
  });
});
