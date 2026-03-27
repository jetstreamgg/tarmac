import { useMorphoVaultRewards } from '@jetstreamgg/sky-hooks';
import { RewardsBalanceCard } from '@/modules/ui/components/BalanceCards';
import { t } from '@lingui/core/macro';

type MorphoVaultRewardsDetailsProps = {
  vaultAddress: `0x${string}`;
};

export function MorphoVaultRewardsDetails({ vaultAddress }: MorphoVaultRewardsDetailsProps) {
  const { data: rewardsData, isLoading, error } = useMorphoVaultRewards({ vaultAddress });

  const rewards = rewardsData?.rewards ?? [];
  const hasRewards = rewards.some(r => r.amount > 0n);

  const defaultToken = {
    symbol: '',
    name: '',
    decimals: 18
  };

  // Return cards wrapped in flex items to sit side by side in parent container
  if (hasRewards) {
    return (
      <>
        {rewards
          .filter(r => r.amount > 0n)
          .map(reward => {
            const token = {
              symbol: reward.tokenSymbol,
              name: reward.tokenSymbol,
              decimals: reward.tokenDecimals
            };

            return (
              <div key={reward.tokenAddress} className="min-w-[250px] flex-1">
                <RewardsBalanceCard
                  balance={reward.formattedAmount}
                  isLoading={isLoading}
                  token={token}
                  label={t`Accumulated Rewards`}
                  error={error}
                />
              </div>
            );
          })}
      </>
    );
  }

  return (
    <div className="min-w-[250px] flex-1">
      <RewardsBalanceCard
        balance={0n}
        isLoading={isLoading}
        token={defaultToken}
        label={t`Accumulated Rewards`}
        error={error}
      />
    </div>
  );
}
