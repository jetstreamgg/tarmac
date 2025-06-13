import { formatAddress } from '@jetstreamgg/sky-utils';
import { t } from '@lingui/core/macro';
import { StatsCard } from '@/modules/ui/components/StatsCard';
import { Text } from '@/modules/layout/components/Typography';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { useRewardContractTokens } from '@jetstreamgg/sky-hooks';

interface SealRewardCardProps {
  selectedReward: string;
}

export function SealRewardCard({ selectedReward }: SealRewardCardProps): React.ReactElement {
  const {
    data: rewardContractTokens,
    isLoading: tokensLoading,
    error: tokensError
  } = useRewardContractTokens(selectedReward as `0x${string}`);

  return (
    <StatsCard
      title={t`Reward`}
      isLoading={tokensLoading}
      error={tokensError}
      content={
        rewardContractTokens ? (
          <div className="mt-2 flex gap-2">
            <TokenIcon token={rewardContractTokens.rewardsToken} className="h-6 w-6" />
            <Text>{rewardContractTokens.rewardsToken.symbol}</Text>
          </div>
        ) : (
          <Text className="mt-2">{formatAddress(selectedReward, 6, 4)}</Text>
        )
      }
    />
  );
}
