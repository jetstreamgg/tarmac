import { RewardContract, useRewardContractInfo, useRewardsChartInfo } from '@jetstreamgg/sky-hooks';
import { formatBigInt, formatNumber } from '@jetstreamgg/sky-utils';
import { t } from '@lingui/core/macro';
import { Text } from '@/modules/layout/components/Typography';
import { StatsCard } from '@/modules/ui/components/StatsCard';
import { PopoverRateInfo as PopoverInfo } from '@jetstreamgg/sky-widgets';
import { formatDecimalPercentage } from '@jetstreamgg/sky-utils';
import { TokenIconWithBalance } from '@/modules/ui/components/TokenIconWithBalance';
import { useSubgraphUrl } from '@/modules/app/hooks/useSubgraphUrl';

export function RewardsTokenInfo({ rewardContract }: { rewardContract: RewardContract }) {
  const subgraphUrl = useSubgraphUrl();
  const {
    data: rewardContractInfoData,
    isLoading: rewardContractInfoIsLoading,
    error: rewardContractInfoError
  } = useRewardContractInfo({
    chainId: rewardContract.chainId,
    rewardContractAddress: rewardContract.contractAddress,
    subgraphUrl
  });

  // for CLE points, we need the data from the chart data, not the contract
  const {
    data: historicRewardsTokenData,
    isLoading: historicRewardsTokenIsLoading,
    error: historicRewardsTokenError
  } = useRewardsChartInfo({
    rewardContractAddress: rewardContract.contractAddress
  });

  const mostRecentReward = historicRewardsTokenData
    ?.slice()
    .sort((a, b) => b.blockTimestamp - a.blockTimestamp)[0];
  const mostRecentRate = mostRecentReward?.rate;

  return (
    <div className="xl:scrollbar-thin flex w-full flex-wrap justify-between gap-3 overflow-auto xl:flex-nowrap">
      <StatsCard
        visible={
          !!rewardContract.supplyToken.symbol &&
          !!rewardContract.rewardToken.symbol &&
          !!mostRecentRate &&
          !isNaN(parseFloat(mostRecentRate)) &&
          parseFloat(mostRecentRate) > 0
        }
        title={t`Rate`}
        isLoading={historicRewardsTokenIsLoading}
        error={historicRewardsTokenError}
        content={
          <div className="mt-2 flex flex-row items-center gap-2">
            <Text className="text-bullish" variant="large">
              {formatDecimalPercentage(parseFloat(mostRecentRate || '0'))}
            </Text>
            <PopoverInfo type="str" />
          </div>
        }
      />
      <StatsCard
        title={t`TVL`}
        isLoading={rewardContractInfoIsLoading}
        error={rewardContractInfoError}
        content={
          <Text className="mt-2" variant="large">
            {`${formatBigInt(rewardContractInfoData?.totalSupplied || 0n)} ${rewardContract.supplyToken.symbol}`}
          </Text>
        }
      />
      <StatsCard
        title={t`Suppliers`}
        isLoading={rewardContractInfoIsLoading}
        error={rewardContractInfoError}
        content={
          <Text className="mt-2" variant="large">
            {formatNumber(mostRecentReward?.suppliers || 0, { maxDecimals: 0 })}
          </Text>
        }
      />
      {rewardContract.rewardToken.symbol === 'CLE' && (
        <StatsCard
          title={t`Total ${rewardContract.rewardToken.symbol} Points rewarded`}
          isLoading={historicRewardsTokenIsLoading}
          error={historicRewardsTokenError}
          content={
            <TokenIconWithBalance
              className="mt-2"
              token={rewardContract.rewardToken}
              balance={`${formatNumber(parseFloat(mostRecentReward?.totalRewarded || '0'))}`}
            />
          }
        />
      )}
      {rewardContract.rewardToken.symbol !== 'CLE' && (
        <StatsCard
          title={t`Total ${rewardContract.rewardToken.symbol} rewarded`}
          isLoading={rewardContractInfoIsLoading}
          error={rewardContractInfoError}
          content={
            <Text className="mt-2" variant="large">
              {`${formatBigInt(rewardContractInfoData?.totalRewardsClaimed || 0n)} ${rewardContract.rewardToken.symbol}`}
            </Text>
          }
        />
      )}
    </div>
  );
}
