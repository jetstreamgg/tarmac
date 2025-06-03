import { RewardsBalanceCard } from '@/modules/ui/components/BalanceCards';
import { useRewardContractTokens, useRewardsRewardsBalance } from '@jetstreamgg/hooks';
import { t } from '@lingui/core/macro';
import { useChainId } from 'wagmi';

export function StakePositionRewardsCard({
  rewardContractAddress,
  urnAddress
}: {
  rewardContractAddress: `0x${string}`;
  urnAddress: `0x${string}`;
}) {
  const chainId = useChainId();

  const {
    data: rewardContractTokens,
    isLoading: tokensLoading,
    error: tokensError
  } = useRewardContractTokens(rewardContractAddress);

  const {
    data: rewardsBalance,
    isLoading: rewardsBalanceLoading,
    error: rewardsBalanceError
  } = useRewardsRewardsBalance({ contractAddress: rewardContractAddress, address: urnAddress, chainId });

  if (!rewardContractTokens || rewardsBalance === undefined) return null;

  return (
    <RewardsBalanceCard
      balance={rewardsBalance || 0n}
      isLoading={rewardsBalanceLoading || tokensLoading}
      error={rewardsBalanceError || tokensError}
      token={rewardContractTokens.rewardsToken}
      label={t`Accrued staking rewards`}
    />
  );
}
