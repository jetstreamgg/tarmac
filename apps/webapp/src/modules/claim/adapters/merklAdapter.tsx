import { useMemo } from 'react';
import { useChainId, useConnection } from 'wagmi';
import type { Call } from 'viem';
import { Trans } from '@lingui/react/macro';
import { useMerklRewards, getWriteContractCall, type MerklTokenReward } from '@/hooks';
import { morphoMerklDistributorAddress, morphoMerklDistributorImplementationAbi } from '@/hooks/generated';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { Merkl } from '@/modules/icons';
import type { ClaimAdapter, ClaimableResult, ClaimCallsResult, ClaimableReward, ClaimScope } from '../types';

const SOURCE_LABEL = 'Merkl';

/** Merkl brand chip (icon + label) shown next to the source group. */
function MerklBadge() {
  return (
    <span className="bg-surface text-text inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium">
      <Merkl className="h-3 w-3" />
      <Trans>Merkl</Trans>
    </span>
  );
}

/** Which of the user's Merkl reward tokens fall inside `scope`. */
function rewardsInScope(rewards: MerklTokenReward[], scope: ClaimScope): MerklTokenReward[] {
  switch (scope.kind) {
    case 'all':
      // Every token the user earned in OUR campaigns. useMerklRewards already drops
      // tokens whose only source is another (non-Sky) Merkl campaign — that filter is
      // intentional and permanent: we never surface other-campaign tokens. The panel
      // then lets the user check/uncheck which of these tokens to claim (default all);
      // each claimed token always claims its full cumulative amount (Merkl has no
      // partial-amount claim), matching the previous app.
      return rewards;
    case 'vault': {
      const target = scope.vaultAddress.toLowerCase();
      return rewards.filter(reward =>
        reward.sources.some(source => source.vaultAddress?.toLowerCase() === target)
      );
    }
    // Merkl contributes nothing to a sky-reward-contract or staking scope.
    case 'reward-contract':
    case 'stake':
      return [];
  }
}

function toClaimableReward(reward: MerklTokenReward): ClaimableReward {
  return {
    id: reward.tokenAddress,
    source: 'merkl',
    sourceLabel: SOURCE_LABEL,
    badge: <MerklBadge />,
    tokenSymbol: reward.tokenSymbol,
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
  const { data, isLoading } = useMerklRewards();
  const rewards = data?.rewards;
  return useMemo(
    () => ({ rewards: rewardsInScope(rewards ?? [], scope).map(toClaimableReward), isLoading }),
    [rewards, scope, isLoading]
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
