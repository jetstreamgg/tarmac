import { useMemo } from 'react';
import { useChainId, useConnection } from 'wagmi';
import { formatUnits, type Call } from 'viem';
import { useMerklRewards, getWriteContractCall, type MerklTokenReward } from '@/hooks';
import { morphoMerklDistributorAddress, morphoMerklDistributorImplementationAbi } from '@/hooks/generated';
import { familyMainnetId } from '@/utils';
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
    // Net claimable, matching the display fields — totalAmount is gross lifetime.
    amount: parseFloat(formatUnits(reward.totalAmount - reward.claimed, reward.tokenDecimals)),
    tokenAddress: reward.tokenAddress,
    amountUsd: reward.totalAmountUsd,
    chainId: reward.distributionChainId
  };
}

/**
 * Is the connected chain the one the distributor lives on? The distributor only
 * exists on the family's Ethereum chain and the claim flow executes on the
 * connected chain, so on L2s nothing is offered — otherwise the modal renders
 * mainnet rewards it can never claim. Both adapter hooks gate on this, which is
 * also what keeps `useMerklRewards` from fetching: the query is disabled only
 * when every observer disables it.
 */
function useClaimableHere(): boolean {
  const chainId = useChainId();
  return chainId === familyMainnetId(chainId);
}

function useMerklClaimable(scope: ClaimScope): ClaimableResult {
  const claimableHere = useClaimableHere();
  const { data, isLoading, mutate } = useMerklRewards({ enabled: claimableHere });
  // A disabled query still returns what the cache holds from the chain the user
  // came from, so the gate has to be applied to the data as well as the fetch.
  const rewards = claimableHere ? data?.rewards : undefined;
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
  const claimableHere = useClaimableHere();
  const { address } = useConnection();
  const { data } = useMerklRewards({ enabled: claimableHere });
  const rewards = claimableHere ? data?.rewards : undefined;

  const selectedIds = useMemo(() => new Set(selected.map(reward => reward.id)), [selected]);
  const distributor = morphoMerklDistributorAddress[familyMainnetId(chainId)];

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
