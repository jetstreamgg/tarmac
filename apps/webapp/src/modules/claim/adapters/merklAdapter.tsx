import { useMemo } from 'react';
import { useChainId, useConnection } from 'wagmi';
import type { Call } from 'viem';
import { useMerklRewards, getWriteContractCall, type MerklTokenReward } from '@/hooks';
import { morphoMerklDistributorAddress, morphoMerklDistributorImplementationAbi } from '@/hooks/generated';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { rewardTokenName } from '../tokenNames';
import type { ClaimAdapter, ClaimableResult, ClaimCallsResult, ClaimableReward, ClaimScope } from '../types';

/** Which of the user's Merkl reward tokens fall inside `scope`. */
function rewardsInScope(rewards: MerklTokenReward[], scope: ClaimScope): MerklTokenReward[] {
  switch (scope.kind) {
    case 'all':
    case 'merkl':
      // Every token the user earned in OUR campaigns. useMerklRewards already drops
      // tokens whose only source is another (non-Sky) Merkl campaign — that filter is
      // intentional and permanent: we never surface other-campaign tokens. Each
      // claimed token always claims its full cumulative amount (Merkl has no
      // partial-amount claim), matching the previous app.
      return rewards;
    case 'merkl-token': {
      const target = scope.tokenAddress.toLowerCase();
      return rewards.filter(reward => reward.tokenAddress.toLowerCase() === target);
    }
    case 'vault': {
      const target = scope.vaultAddress.toLowerCase();
      return rewards.filter(reward =>
        reward.sources.some(source => source.vaultAddress?.toLowerCase() === target)
      );
    }
    // Merkl contributes nothing to a sky-reward or staking scope.
    case 'sky-rewards':
    case 'reward-contract':
    case 'stake':
      return [];
  }
}

function toClaimableReward(reward: MerklTokenReward): ClaimableReward {
  return {
    id: reward.tokenAddress,
    source: 'merkl',
    tokenSymbol: reward.tokenSymbol,
    tokenName: rewardTokenName(reward.tokenSymbol),
    icon: (
      <TokenIcon
        token={{ symbol: reward.tokenSymbol }}
        width={32}
        showChainIcon={false}
        className="h-8 w-8"
      />
    ),
    formattedAmount: reward.formattedTotalAmount,
    amountUsd: reward.totalAmountUsd,
    chainId: reward.distributionChainId
  };
}

function useMerklClaimable(scope: ClaimScope): ClaimableResult {
  const { data, isLoading, mutate } = useMerklRewards();
  const rewards = data?.rewards;
  return useMemo(
    () => ({
      rewards: rewardsInScope(rewards ?? [], scope).map(toClaimableReward),
      isLoading,
      refresh: mutate
    }),
    [rewards, scope, isLoading, mutate]
  );
}

function useMerklClaimCalls(selected: ClaimableReward[]): ClaimCallsResult {
  const chainId = useChainId();
  const { address } = useConnection();
  const { data } = useMerklRewards();
  const rewards = data?.rewards;

  const selectedIds = useMemo(() => new Set(selected.map(reward => reward.id)), [selected]);
  const distributor = morphoMerklDistributorAddress[chainId as keyof typeof morphoMerklDistributorAddress];

  return useMemo(() => {
    // Merkl always claims the full cumulative amount per token (see useMerklClaimRewards):
    // a token is claimable only with an unclaimed remainder AND a proof. One `claim` call
    // covers every selected token, so this is always a single Call.
    const claimable = (rewards ?? []).filter(
      reward =>
        selectedIds.has(reward.tokenAddress) &&
        reward.totalAmount > reward.claimed &&
        reward.proofs.length > 0
    );
    if (!address || !distributor || claimable.length === 0) {
      return { calls: [], prepared: false };
    }

    const users = claimable.map(() => address);
    const tokens = claimable.map(reward => reward.tokenAddress);
    const amounts = claimable.map(reward => reward.totalAmount);
    const proofs = claimable.map(reward => reward.proofs as `0x${string}`[]);

    const calls: Call[] = [
      getWriteContractCall({
        to: distributor,
        abi: morphoMerklDistributorImplementationAbi,
        functionName: 'claim',
        args: [users, tokens, amounts, proofs]
      })
    ];
    return { calls, prepared: true };
  }, [rewards, selectedIds, address, distributor]);
}

/**
 * Merkl claim adapter — normalizes the Merkl distributor rewards into the shared
 * `ClaimableReward` shape and builds the distributor `claim(users, tokens, amounts,
 * proofs)` calldata for a selected subset. The two hooks are a stable pair the panel
 * calls unconditionally (rules-of-hooks); `useClaimCalls` produces raw `Call[]` so the
 * panel can merge it with the other sources into one `useTransactionFlow`.
 */
export const merklAdapter: ClaimAdapter = {
  source: 'merkl',
  useClaimable: useMerklClaimable,
  useClaimCalls: useMerklClaimCalls
};
