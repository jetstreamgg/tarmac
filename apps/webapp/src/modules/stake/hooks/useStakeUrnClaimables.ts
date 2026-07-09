import { useMemo } from 'react';
import { useChainId } from 'wagmi';
import {
  useRewardContractsToClaim,
  useStakeRewardContracts,
  useStakeUrnAddress,
  ZERO_ADDRESS
} from '@/hooks';

export interface StakeUrnClaimable {
  contractAddress: `0x${string}`;
  claimBalance: bigint;
  rewardSymbol: string;
}

/**
 * Raw claimable rewards of ONE urn across ALL stake reward contracts — the
 * legacy `ClaimRewardsDropdown` read (every farm, not just the urn's selected
 * one, so residual claimables from a previous farm surface too — C12), with the
 * legacy SKY-first sort (`ClaimRewardsDropdown.tsx:105-116`). Feeds the claim
 * modal, the claim launch seam (`restakeSkyAmount` needs raw balances) and the
 * details modal's claimable stats.
 */
export function useStakeUrnClaimables(urnIndex: bigint | undefined): {
  claimables: StakeUrnClaimable[];
  isLoading: boolean;
  urnAddress: `0x${string}` | undefined;
} {
  const chainId = useChainId();
  const { data: urnAddress } = useStakeUrnAddress(urnIndex ?? 0n);
  const { data: stakeRewardContracts } = useStakeRewardContracts();

  const rewardContractAddresses = useMemo(
    () => stakeRewardContracts?.map(({ contractAddress }) => contractAddress) ?? [],
    [stakeRewardContracts]
  );

  const { data, isLoading } = useRewardContractsToClaim({
    rewardContractAddresses,
    addresses: urnAddress,
    chainId,
    enabled:
      urnIndex !== undefined &&
      rewardContractAddresses.length > 0 &&
      !!urnAddress &&
      urnAddress !== ZERO_ADDRESS
  });

  const claimables = useMemo(() => {
    const rewards = (data ?? []) as StakeUrnClaimable[];
    // Legacy sort, verbatim: SKY first, otherwise stable.
    return [...rewards].sort((a, b) => {
      const aIsSky = a.rewardSymbol?.toUpperCase?.() === 'SKY';
      const bIsSky = b.rewardSymbol?.toUpperCase?.() === 'SKY';

      if (aIsSky && !bIsSky) return -1;
      if (!aIsSky && bIsSky) return 1;
      return 0;
    });
  }, [data]);

  return { claimables, isLoading, urnAddress: urnIndex !== undefined ? urnAddress : undefined };
}
