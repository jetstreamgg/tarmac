import { useMemo } from 'react';
import { useChainId, useConnection } from 'wagmi';
import { formatUnits, type Call } from 'viem';
import {
  useAvailableTokenRewardContracts,
  useRewardContractsToClaim,
  usePrices,
  getTokenDecimals,
  getWriteContractCall
} from '@/hooks';
import { usdsSkyRewardAbi } from '@/hooks/generated';
import { formatBigInt } from '@/utils';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { rewardTokenName } from '../tokenNames';
import type { ClaimAdapter, ClaimableResult, ClaimCallsResult, ClaimableReward, ClaimScope } from '../types';

function useSkyRewardsClaimable(scope: ClaimScope): ClaimableResult {
  const chainId = useChainId();
  const { address } = useConnection();
  const rewardContracts = useAvailableTokenRewardContracts(chainId);
  const { data: prices } = usePrices();

  // Curve-style StakingRewards contracts only live in the source-wide and
  // per-contract scopes; a Merkl, Morpho-vault or staking-urn scope never
  // contains one.
  const relevant = scope.kind === 'all' || scope.kind === 'sky-rewards' || scope.kind === 'reward-contract';

  const rewardContractAddresses = useMemo(
    () => rewardContracts.map(contract => contract.contractAddress as `0x${string}`),
    [rewardContracts]
  );

  const { data, isLoading, mutate } = useRewardContractsToClaim({
    rewardContractAddresses,
    addresses: address,
    chainId,
    enabled: relevant && rewardContractAddresses.length > 0 && !!address
  });

  return useMemo(() => {
    if (!relevant) return { rewards: [], isLoading: false, refresh: mutate };

    const claimable = data ?? [];
    const scoped =
      scope.kind === 'reward-contract'
        ? claimable.filter(reward => reward.contractAddress.toLowerCase() === scope.address.toLowerCase())
        : claimable;

    const rewards: ClaimableReward[] = scoped.map(({ contractAddress, claimBalance, rewardSymbol }) => {
      const rewardToken = rewardContracts.find(
        contract => contract.contractAddress.toLowerCase() === contractAddress.toLowerCase()
      )?.rewardToken;
      const decimals = getTokenDecimals(rewardToken, chainId);
      const price = prices?.[rewardSymbol]?.price;
      const amountUsd = price ? parseFloat(formatUnits(claimBalance, decimals)) * parseFloat(price) : 0;
      return {
        id: contractAddress,
        source: 'sky-rewards',
        tokenSymbol: rewardSymbol,
        tokenName: rewardTokenName(rewardSymbol),
        icon: (
          <TokenIcon token={{ symbol: rewardSymbol }} width={32} showChainIcon={false} className="h-8 w-8" />
        ),
        formattedAmount: formatBigInt(claimBalance, { unit: decimals, maxDecimals: 2 }),
        amount: parseFloat(formatUnits(claimBalance, decimals)),
        tokenAddress: rewardToken?.address?.[chainId],
        amountUsd,
        chainId
      };
    });

    return { rewards, isLoading, refresh: mutate };
  }, [relevant, data, scope, rewardContracts, prices, chainId, isLoading, mutate]);
}

function useSkyRewardsClaimCalls(selected: ClaimableReward[]): ClaimCallsResult {
  const { address } = useConnection();

  return useMemo(() => {
    // getReward() takes no args and claims the contract's full earned balance — one
    // Call per selected reward contract (mirrors useBatchClaimAllRewards' calldata,
    // but over the selected subset rather than all-or-nothing).
    const contracts = selected.filter(reward => reward.source === 'sky-rewards');
    if (!address || contracts.length === 0) return { calls: [], prepared: false };

    const calls: Call[] = contracts.map(reward =>
      getWriteContractCall({
        to: reward.id as `0x${string}`,
        abi: usdsSkyRewardAbi,
        functionName: 'getReward',
        args: []
      })
    );
    return { calls, prepared: true };
  }, [selected, address]);
}

/**
 * Sky rewards claim adapter (Curve-style StakingRewards `getReward`). `useClaimable`
 * reads earned balances across the user's reward contracts and normalizes each into a
 * `ClaimableReward` (one token per contract, no proofs/amounts); `useClaimCalls` builds
 * a no-arg `getReward()` Call per selected contract. The panel merges these with the
 * other sources into one `useTransactionFlow`, so per-contract subset selection comes
 * for free (unlike the all-or-nothing useBatchClaimAllRewards). Mainnet-only.
 */
export const skyRewardsAdapter: ClaimAdapter = {
  source: 'sky-rewards',
  useClaimable: useSkyRewardsClaimable,
  useClaimCalls: useSkyRewardsClaimCalls
};
