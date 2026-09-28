import { useMemo } from 'react';
import { Trans } from '@lingui/react/macro';
import { useChainId } from 'wagmi';
import { usePrices, useRewardContractsToClaim, useStakeRewardContracts } from '@/hooks';
import { formatBigInt } from '@/utils';
import type { ClaimableReward } from '@/modules/claim';
import { rewardTokenName } from '@/modules/claim/tokenNames';
import { RewardsClaimTable } from '@/modules/portfolio/components/RewardsClaimTable';
import { StakeUserPosition } from '../hooks/useStakeUserPositions';
import { priceOfFromPrices, wadToFloat, wadToUsd } from '../lib/stakeUsdNotional';

/**
 * My positions Rewards section (comp 3617:24049): claimable rewards across the
 * wallet's urns, one row per reward contract (the read sums urns per
 * contract). Claim opens the claim modal for the urn; with several urns that
 * target is ambiguous until the per-token claim lands, so the row CTA only
 * shows for a single urn.
 */
export function StakeRewardsSection({
  positions,
  onClaim
}: {
  positions?: StakeUserPosition[];
  onClaim: (position: StakeUserPosition) => void;
}) {
  const chainId = useChainId();
  const { data: rewardContracts } = useStakeRewardContracts();
  const urnAddresses = useMemo(
    () =>
      (positions ?? [])
        .map(position => position.urnAddress)
        .filter((address): address is `0x${string}` => Boolean(address)),
    [positions]
  );
  const { data: toClaim } = useRewardContractsToClaim({
    rewardContractAddresses: rewardContracts?.map(({ contractAddress }) => contractAddress) ?? [],
    addresses: urnAddresses,
    chainId,
    enabled: Boolean(urnAddresses.length && rewardContracts?.length)
  });
  const { data: prices } = usePrices();

  const rewards = useMemo<ClaimableReward[]>(() => {
    const priceOf = priceOfFromPrices(prices);
    return (toClaim ?? []).map(({ contractAddress, claimBalance, rewardSymbol }) => ({
      id: contractAddress,
      source: 'stake',
      tokenSymbol: rewardSymbol,
      tokenName: rewardTokenName(rewardSymbol),
      icon: null,
      formattedAmount: formatBigInt(claimBalance, { unit: 18, minDecimals: 2, maxDecimals: 2 }),
      amount: wadToFloat(claimBalance),
      amountUsd: wadToUsd(claimBalance, priceOf(rewardSymbol)),
      chainId
    }));
  }, [toClaim, prices, chainId]);

  // Emptied urns can still hold unclaimed rewards, so they count as targets.
  const claimTarget = positions?.length === 1 ? positions[0] : undefined;

  if (rewards.length === 0) return null;

  return (
    <section data-testid="stake-rewards-section" className="order-2 flex flex-col gap-5">
      <h3 className="text-fgPrimary font-circle text-lg leading-[22px] font-medium tracking-[-0.36px]">
        <Trans>Rewards</Trans>
      </h3>
      <RewardsClaimTable
        rewards={rewards}
        ctaVariant="primary"
        onClaim={claimTarget ? () => onClaim(claimTarget) : undefined}
        testId="stake-rewards-table"
      />
    </section>
  );
}
