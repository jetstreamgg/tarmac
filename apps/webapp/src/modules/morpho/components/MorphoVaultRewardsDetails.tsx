import { useMorphoVaultRewards } from '@jetstreamgg/sky-hooks';
import { RewardsBalanceCard } from '@/modules/ui/components/BalanceCards';
import { t } from '@lingui/core/macro';

type MorphoVaultRewardsDetailsProps = {
  vaultAddress: `0x${string}`;
};

export function MorphoVaultRewardsDetails({ vaultAddress }: MorphoVaultRewardsDetailsProps) {
  const { data: rewardsData, isLoading, error } = useMorphoVaultRewards({ vaultAddress });

  // If no rewards data or no claimable rewards and not loading, don't render
  if (!isLoading && (!rewardsData || !rewardsData.hasClaimableRewards)) {
    return null;
  }

  // Build reward cards for each token
  const rewardCards = rewardsData?.rewards
    .filter(r => r.pending > 0n)
    .map(reward => {
      const token = {
        symbol: reward.tokenSymbol,
        name: reward.tokenSymbol,
        decimals: reward.tokenDecimals
      };

      return (
        <RewardsBalanceCard
          key={reward.tokenAddress}
          balance={reward.formattedPending}
          isLoading={isLoading}
          token={token}
          label={t`Accumulated Rewards`}
          error={error}
        />
      );
    });

  // Show loading state
  if (isLoading) {
    const loadingToken = {
      symbol: '',
      name: '',
      decimals: 18
    };

    return (
      <div className="flex w-full flex-col gap-3">
        <RewardsBalanceCard
          balance={0n}
          isLoading={true}
          token={loadingToken}
          label={t`Accumulated Rewards`}
        />
      </div>
    );
  }

  if (!rewardCards || rewardCards.length === 0) {
    return null;
  }

  return <div className="flex w-full flex-col gap-3">{rewardCards}</div>;
}
