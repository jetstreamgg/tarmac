import { useMemo } from 'react';
import { useChainId } from 'wagmi';
import { usePrices, useRewardContractsToClaim, useStakeRewardContracts } from '@/hooks';
import { priceOfFromPrices, sumRewardsUsd } from '../lib/stakeUsdNotional';

/**
 * Claimable rewards of ONE urn across every stake reward contract, valued
 * through the price feed — the read the positions table cell, the row banner
 * and the liquidation post-mortem all make. `unavailable` is the "a failed
 * claimables read is unknown, not $0.00" rule; a read that failed after a
 * previous success keeps showing the stale figure.
 */
export function useUrnClaimableRewardsUsd(urnAddress: `0x${string}` | undefined) {
  const chainId = useChainId();
  const { data: rewardContracts } = useStakeRewardContracts();
  const {
    data: toClaim,
    isLoading: claimableLoading,
    error: claimableError
  } = useRewardContractsToClaim({
    rewardContractAddresses: rewardContracts?.map(({ contractAddress }) => contractAddress) ?? [],
    addresses: urnAddress ? [urnAddress] : [],
    chainId,
    enabled: Boolean(urnAddress && rewardContracts?.length)
  });
  const { data: prices, isLoading: pricesLoading } = usePrices();
  const priceOf = useMemo(() => priceOfFromPrices(prices), [prices]);
  const claimable = useMemo(() => toClaim ?? [], [toClaim]);

  return {
    /** The raw read; `undefined` until it lands (or when it failed with nothing cached). */
    toClaim,
    claimable,
    claimableUsd: sumRewardsUsd(claimable, priceOf),
    priceOf,
    claimableLoading,
    pricesLoading,
    isLoading: claimableLoading || pricesLoading,
    unavailable: Boolean(claimableError && !toClaim)
  };
}
