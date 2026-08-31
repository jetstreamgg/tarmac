import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ClaimableReward } from '../types';

const USER = '0x1111111111111111111111111111111111111111';
const VAULT_A = '0xaAaA000000000000000000000000000000000001';
const MERKL_DISTRIBUTOR = '0x3Ef3D8bA38EBe18DB133cEc108f4D14CE00Dd9Ae';

type Source = { label: string; amount: bigint; formattedAmount: string; vaultAddress?: string };
type Reward = {
  tokenAddress: string;
  tokenSymbol: string;
  tokenDecimals: number;
  tokenPrice: number;
  totalAmount: bigint;
  claimed: bigint;
  formattedTotalAmount: string;
  totalAmountUsd: number;
  sources: Source[];
  proofs: string[];
  root: string;
  distributionChainId: number;
};

const reward = (overrides: Partial<Reward> = {}): Reward => ({
  tokenAddress: '0xtoken1',
  tokenSymbol: 'MORPHO',
  tokenDecimals: 18,
  tokenPrice: 1,
  totalAmount: 100n,
  claimed: 0n,
  formattedTotalAmount: '22.90',
  totalAmountUsd: 15.78,
  sources: [{ label: 'Vault A', amount: 100n, formattedAmount: '22.90', vaultAddress: VAULT_A }],
  proofs: ['0xproof'],
  root: '0x',
  distributionChainId: 1,
  ...overrides
});

const h = vi.hoisted(() => ({ rewards: [] as Reward[], address: undefined as string | undefined }));

vi.mock('wagmi', () => ({
  useChainId: () => 1,
  useConnection: () => ({ address: h.address })
}));

vi.mock('@/hooks', () => ({
  useMerklRewards: () => ({ data: { rewards: h.rewards }, isLoading: false }),
  // Real getWriteContractCall is an identity cast — mirror it so the test asserts on the args.
  getWriteContractCall: (params: unknown) => params
}));

vi.mock('@/modules/ui/components/TokenIcon', () => ({ TokenIcon: () => null }));
vi.mock('@/modules/icons', () => ({ Merkl: () => null }));

import { merklAdapter } from './merklAdapter';

const asMerklSelection = (rewards: Reward[]): ClaimableReward[] =>
  rewards.map(r => ({
    id: r.tokenAddress,
    source: 'merkl',
    tokenName: 'Morpho token',
    tokenSymbol: r.tokenSymbol,
    icon: null,
    formattedAmount: r.formattedTotalAmount,
    amount: 0,
    tokenAddress: r.tokenAddress as `0x${string}`,
    amountUsd: r.totalAmountUsd,
    chainId: r.distributionChainId
  }));

describe('merklAdapter', () => {
  it('is the merkl source', () => {
    expect(merklAdapter.source).toBe('merkl');
  });

  describe('useClaimable', () => {
    it('maps every token into a normalized ClaimableReward for scope=all', () => {
      h.rewards = [reward({ tokenAddress: '0xa', tokenSymbol: 'MORPHO' })];
      const { result } = renderHook(() => merklAdapter.useClaimable({ kind: 'all' }));

      expect(result.current.isLoading).toBe(false);
      expect(result.current.rewards).toHaveLength(1);
      expect(result.current.rewards[0]).toMatchObject({
        id: '0xa',
        source: 'merkl',
        tokenName: 'Morpho token',
        tokenSymbol: 'MORPHO',
        formattedAmount: '22.90',
        amountUsd: 15.78,
        chainId: 1
      });
    });

    it('derives amount from the net claimable, not the gross cumulative total', () => {
      // 100 earned lifetime, 60 already claimed → analytics amount must be 40.
      h.rewards = [reward({ totalAmount: 100n * 10n ** 18n, claimed: 60n * 10n ** 18n })];
      const { result } = renderHook(() => merklAdapter.useClaimable({ kind: 'all' }));

      expect(result.current.rewards[0].amount).toBe(40);
    });

    it('filters to tokens sourced from the scoped vault for scope=vault', () => {
      h.rewards = [
        reward({
          tokenAddress: '0xa',
          sources: [{ label: 'Vault A', amount: 1n, formattedAmount: '1', vaultAddress: VAULT_A }]
        }),
        reward({
          tokenAddress: '0xb',
          sources: [{ label: 'Other campaigns', amount: 1n, formattedAmount: '1' }]
        })
      ];
      const { result } = renderHook(() =>
        // Mixed-case target proves the match is case-insensitive.
        merklAdapter.useClaimable({ kind: 'vault', vaultAddress: VAULT_A.toUpperCase() as `0x${string}` })
      );

      expect(result.current.rewards.map(r => r.id)).toEqual(['0xa']);
    });

    it('contributes nothing to non-merkl scopes', () => {
      h.rewards = [reward()];
      const rewardContract = renderHook(() =>
        merklAdapter.useClaimable({ kind: 'reward-contract', address: '0xcontract' })
      );
      const stake = renderHook(() => merklAdapter.useClaimable({ kind: 'stake', index: 0n }));

      expect(rewardContract.result.current.rewards).toEqual([]);
      expect(stake.result.current.rewards).toEqual([]);
    });
  });

  describe('useClaimCalls', () => {
    it('builds a single distributor claim call covering every selected token', () => {
      h.address = USER;
      h.rewards = [
        reward({ tokenAddress: '0xa', totalAmount: 100n, proofs: ['0xp1'] }),
        reward({ tokenAddress: '0xb', totalAmount: 200n, proofs: ['0xp2'] })
      ];
      const { result } = renderHook(() => merklAdapter.useClaimCalls(asMerklSelection(h.rewards)));

      expect(result.current.prepared).toBe(true);
      expect(result.current.calls).toHaveLength(1);
      const call = result.current.calls[0] as unknown as {
        to: string;
        functionName: string;
        args: [string[], string[], bigint[], string[][]];
      };
      expect(call.to).toBe(MERKL_DISTRIBUTOR);
      expect(call.functionName).toBe('claim');
      expect(call.args[0]).toEqual([USER, USER]);
      expect(call.args[1]).toEqual(['0xa', '0xb']);
      expect(call.args[2]).toEqual([100n, 200n]);
      expect(call.args[3]).toEqual([['0xp1'], ['0xp2']]);
    });

    it('excludes tokens with nothing left to claim or no proof', () => {
      h.address = USER;
      h.rewards = [
        reward({ tokenAddress: '0xa', totalAmount: 100n, claimed: 100n, proofs: ['0xp1'] }), // fully claimed
        reward({ tokenAddress: '0xb', totalAmount: 200n, proofs: [] }), // no proof
        reward({ tokenAddress: '0xc', totalAmount: 300n, proofs: ['0xp3'] }) // claimable
      ];
      const { result } = renderHook(() => merklAdapter.useClaimCalls(asMerklSelection(h.rewards)));

      const call = result.current.calls[0] as unknown as { args: [string[], string[], bigint[]] };
      expect(call.args[1]).toEqual(['0xc']);
      expect(call.args[2]).toEqual([300n]);
    });

    it('is unprepared with no selection, no wallet, or nothing claimable', () => {
      h.address = USER;
      h.rewards = [reward({ tokenAddress: '0xa' })];
      const noSelection = renderHook(() => merklAdapter.useClaimCalls([]));
      expect(noSelection.result.current).toEqual({ calls: [], prepared: false });

      h.address = undefined;
      const noWallet = renderHook(() => merklAdapter.useClaimCalls(asMerklSelection(h.rewards)));
      expect(noWallet.result.current).toEqual({ calls: [], prepared: false });
    });
  });
});
