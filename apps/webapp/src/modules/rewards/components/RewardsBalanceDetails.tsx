import {
  SuppliedBalanceCard,
  UnsuppliedBalanceCard,
  RewardsBalanceCard
} from '@/modules/ui/components/BalanceCards';
import {
  RewardContract,
  useRewardsSuppliedBalance,
  useRewardsRewardsBalance,
  useTokenBalance,
  useUserRewardsBalance,
  ZERO_ADDRESS,
  TOKENS
} from '@jetstreamgg/sky-hooks';
import { formatNumber } from '@jetstreamgg/sky-utils';
import { t } from '@lingui/core/macro';
import { useConnection, useChainId } from 'wagmi';

export function RewardsBalanceDetails({ rewardContract }: { rewardContract: RewardContract }) {
  const { address } = useConnection();
  const chainId = useChainId();

  // Balance of the token to be supplied
  const {
    data: tokenBalance,
    isLoading: tokenBalanceLoading,
    error: tokenBalanceError
  } = useTokenBalance({
    chainId,
    address,
    token: rewardContract.supplyToken.address[chainId]
  });

  // Amount of tokens supplied in the contract
  const {
    data: suppliedBalance,
    isLoading: suppliedBalanceLoading,
    error: suppliedBalanceError
  } = useRewardsSuppliedBalance({
    chainId,
    address,
    contractAddress: rewardContract.contractAddress as `0x${string}`
  });

  // Rewards balance
  const {
    data: rewardsBalance,
    isLoading: rewardsBalanceLoading,
    error: rewardsBalanceError
  } = useRewardsRewardsBalance({
    chainId,
    address,
    contractAddress: rewardContract.contractAddress as `0x${string}`
  });

  // Rewards points
  const {
    data: pointsData,
    isLoading: pointsLoading,
    error: pointsError
  } = useUserRewardsBalance({
    chainId,
    address: address || ZERO_ADDRESS,
    contractAddress: rewardContract.contractAddress as `0x${string}`
  });

  const rewardsPoints = formatNumber(parseFloat(pointsData?.rewardBalance || '0'), {
    maxDecimals: 2,
    compact: true
  });

  const shouldShowPoints = rewardContract.rewardToken.symbol === TOKENS.cle.symbol;

  return (
    <div className="flex w-full flex-wrap justify-between gap-3">
      <div className="min-w-[250px] flex-1">
        <SuppliedBalanceCard
          label={t`USDS supplied`}
          balance={suppliedBalance || 0n}
          isLoading={suppliedBalanceLoading}
          error={suppliedBalanceError}
          token={rewardContract.supplyToken}
        />
      </div>
      <div className="min-w-[250px] flex-1">
        <UnsuppliedBalanceCard
          label={t`USDS not supplied`}
          balance={tokenBalance?.value || 0n}
          isLoading={tokenBalanceLoading}
          error={tokenBalanceError}
          token={rewardContract.supplyToken}
        />
      </div>
      <div className="min-w-[250px] flex-1">
        <RewardsBalanceCard
          balance={shouldShowPoints ? rewardsPoints : rewardsBalance || 0n}
          isLoading={shouldShowPoints ? pointsLoading : rewardsBalanceLoading}
          error={shouldShowPoints ? pointsError : rewardsBalanceError}
          token={rewardContract.rewardToken}
        />
      </div>
    </div>
  );
}
