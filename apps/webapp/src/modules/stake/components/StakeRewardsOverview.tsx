/* eslint-disable react/no-unescaped-entities */
import { HStack } from '@/modules/layout/components/HStack';
import { Heading, Text } from '@/modules/layout/components/Typography';
import { VStack } from '@/modules/layout/components/VStack';
import { LoadingErrorWrapper } from '@/modules/ui/components/LoadingErrorWrapper';
import { LoadingStatCard } from '@/modules/ui/components/LoadingStatCard';
import { PopoverInfo } from '@/modules/ui/components/PopoverInfo';
import { StatsCard } from '@/modules/ui/components/StatsCard';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import {
  lsSkyUsdsRewardAddress,
  useRewardContractTokens,
  useRewardsChartInfo,
  useStakeHistoricData,
  useStakeRewardContracts
} from '@jetstreamgg/sky-hooks';
import { formatAddress, formatDecimalPercentage, formatNumber } from '@jetstreamgg/sky-utils';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { useMemo } from 'react';
import { useChainId } from 'wagmi';

const StakeRewardsOverviewRow = ({ contractAddress }: { contractAddress: `0x${string}` }) => {
  const {
    data: rewardContractTokens,
    isLoading: tokensLoading,
    error: tokensError
  } = useRewardContractTokens(contractAddress);

  const chainId = useChainId();

  // const {
  //   data: rewardRate,
  //   isLoading: rateLoading,
  //   error: rateError
  // } = useRewardsRate({ chainId, contractAddress });

  const {
    data: historicRewardsTokenData,
    isLoading: historicRewardsTokenIsLoading,
    error: historicRewardsTokenError
  } = useRewardsChartInfo({
    rewardContractAddress: contractAddress
  });
  const mostRecentReward = useMemo(
    () => historicRewardsTokenData?.slice().sort((a, b) => b.blockTimestamp - a.blockTimestamp)[0],
    [historicRewardsTokenData]
  );

  //Get the MKR price from the seal historic data endpoint, since that is used for the total seal TVL
  //and we want the farm TVLs to sum up to the total seal TVL
  const {
    data: stakeHistoricData,
    isLoading: stakeHistoricIsLoading,
    error: stakeHistoricError
  } = useStakeHistoricData();
  const mostRecentStakeData = useMemo(
    () =>
      stakeHistoricData?.sort((a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime())[0],
    [stakeHistoricData]
  );

  // Fetch from this BA labs endpoint to get the rate
  const { data: rewardsChartInfoData } = useRewardsChartInfo({
    rewardContractAddress: lsSkyUsdsRewardAddress[chainId as keyof typeof lsSkyUsdsRewardAddress]
  });

  const mostRecentRewardsChartInfoData = useMemo(
    () => rewardsChartInfoData?.slice().sort((a, b) => b.blockTimestamp - a.blockTimestamp)[0],
    [rewardsChartInfoData]
  );

  const skyPrice = mostRecentStakeData?.skyPrice ? Number(mostRecentStakeData.skyPrice) : 0;

  const totalSupplied = mostRecentReward?.totalSupplied ? parseFloat(mostRecentReward.totalSupplied) : 0;
  const totalSuppliedInDollars = !isNaN(totalSupplied) && !isNaN(skyPrice) ? totalSupplied * skyPrice : 0;

  return (
    <HStack gap={2} className="scrollbar-thin w-full overflow-auto">
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
            <Text className="mt-2">{formatAddress(contractAddress, 6, 4)}</Text>
          )
        }
      />
      <StatsCard
        title={
          <HStack gap={1} className="items-center">
            <Heading tag="h3" className="text-textSecondary text-sm font-normal leading-tight">
              <Trans>Rate</Trans>
            </Heading>
            <PopoverInfo type="srr" />
          </HStack>
        }
        isLoading={false}
        error={null}
        content={
          <Text
            className={`mt-2 ${
              parseFloat(mostRecentRewardsChartInfoData?.rate || '0') > 0 ? 'text-bullish' : ''
            }`}
          >
            {formatDecimalPercentage(parseFloat(mostRecentRewardsChartInfoData?.rate || '0'))}
          </Text>
        }
      />
      <StatsCard
        title={t`TVL (Total Value Locked)`}
        isLoading={historicRewardsTokenIsLoading || stakeHistoricIsLoading}
        error={historicRewardsTokenError || stakeHistoricError}
        content={<Text className="mt-2">{`$${formatNumber(totalSuppliedInDollars)}`}</Text>}
      />
      <StatsCard
        title={t`Suppliers`}
        isLoading={historicRewardsTokenIsLoading}
        error={historicRewardsTokenError}
        content={<Text className="mt-2">{mostRecentReward?.suppliers || 0}</Text>}
      />
    </HStack>
  );
};

export function StakeRewardsOverview() {
  const { data, isLoading, error } = useStakeRewardContracts();

  return (
    <LoadingErrorWrapper
      isLoading={isLoading}
      loadingComponent={
        <HStack gap={2} className="scrollbar-thin w-full overflow-auto">
          {[1, 2, 3, 4].map(i => (
            <LoadingStatCard key={i} />
          ))}
        </HStack>
      }
      error={error}
      errorComponent={
        <Text variant="large" className="text-text text-center">
          <Trans>We couldn't load the Stake module rewards. Please try again later.</Trans>
        </Text>
      }
    >
      <VStack className="space-y-8">
        {data?.map(({ contractAddress }) => (
          <StakeRewardsOverviewRow key={contractAddress} contractAddress={contractAddress} />
        ))}
      </VStack>
    </LoadingErrorWrapper>
  );
}
