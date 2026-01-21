import { RewardsBalanceCard } from '@/modules/ui/components/BalanceCards';
import { useRewardContractTokens, useRewardsRewardsBalance } from '@jetstreamgg/sky-hooks';
import { useConnection, useChainId } from 'wagmi';

export function SealPositionRewardsCard({ rewardContractAddress }: { rewardContractAddress: `0x${string}` }) {
  const chainId = useChainId();
  const { address } = useConnection();

  const {
    data: rewardContractTokens,
    isLoading: tokensLoading,
    error: tokensError
  } = useRewardContractTokens(rewardContractAddress);

  const {
    data: rewardsBalance,
    isLoading: rewardsBalanceLoading,
    error: rewardsBalanceError
  } = useRewardsRewardsBalance({ contractAddress: rewardContractAddress, address, chainId });

  if (!rewardContractTokens || rewardsBalance === undefined) return null;

  return (
    <RewardsBalanceCard
      balance={rewardsBalance || 0n}
      isLoading={rewardsBalanceLoading || tokensLoading}
      error={rewardsBalanceError || tokensError}
      token={rewardContractTokens.rewardsToken}
    />
  );
}
