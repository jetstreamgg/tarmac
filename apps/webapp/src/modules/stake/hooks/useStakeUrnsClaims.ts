import { useMemo } from 'react';
import { useChainId } from 'wagmi';
import { useRewardContractsToClaim, useStakeRewardContracts } from '@/hooks';
import type { StakeUrnClaim } from '../lib/stakeClaims';

export type StakeClaimTarget = { urnIndex: bigint; urnAddress: `0x${string}` };

/**
 * Claimable balances of several urns across every stake reward contract, one
 * entry per (urn, contract), optionally narrowed to `rewardContracts` (a
 * Rewards-section token row). Backs the section and its multi-urn claim modal.
 */
export function useStakeUrnsClaims(
  targets: readonly StakeClaimTarget[],
  rewardContracts?: readonly `0x${string}`[]
): { claims: StakeUrnClaim[]; isLoading: boolean } {
  const chainId = useChainId();
  const { data: stakeRewardContracts } = useStakeRewardContracts();

  const contractAddresses = useMemo(
    () => stakeRewardContracts?.map(({ contractAddress }) => contractAddress) ?? [],
    [stakeRewardContracts]
  );
  const urnAddresses = useMemo(() => targets.map(target => target.urnAddress), [targets]);

  const { data, isLoading } = useRewardContractsToClaim({
    rewardContractAddresses: contractAddresses,
    addresses: urnAddresses,
    chainId,
    enabled: urnAddresses.length > 0 && contractAddresses.length > 0
  });

  const claims = useMemo(() => {
    const indexOf = new Map(targets.map(target => [target.urnAddress.toLowerCase(), target.urnIndex]));
    const only = rewardContracts && new Set(rewardContracts.map(address => address.toLowerCase()));
    return (data ?? []).flatMap(({ address, contractAddress, claimBalance, rewardSymbol }) => {
      const urnIndex = indexOf.get(address.toLowerCase());
      if (urnIndex === undefined || (only && !only.has(contractAddress.toLowerCase()))) return [];
      return [{ urnIndex, contractAddress, claimBalance, rewardSymbol }];
    });
  }, [data, targets, rewardContracts]);

  return { claims, isLoading };
}
