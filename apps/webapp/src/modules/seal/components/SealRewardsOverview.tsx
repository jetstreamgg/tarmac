/* eslint-disable react/no-unescaped-entities */
import { HStack } from '@/modules/layout/components/HStack';
import { Text } from '@/modules/layout/components/Typography';
import { VStack } from '@/modules/layout/components/VStack';
import { LoadingErrorWrapper } from '@/modules/ui/components/LoadingErrorWrapper';
import { LoadingStatCard } from '@/modules/ui/components/LoadingStatCard';
import { StatsCard } from '@/modules/ui/components/StatsCard';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import {
  useRewardContractTokens,
  useRewardsChartInfo,
  useSaRewardContracts,
  useSealHistoricData
} from '@jetstreamgg/sky-hooks';
import { formatAddress, formatNumber } from '@jetstreamgg/sky-utils';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { useMemo } from 'react';

const SealRewardsOverviewRow = ({ contractAddress }: { contractAddress: `0x${string}` }) => {
  const {
    data: rewardContractTokens,
    isLoading: tokensLoading,
    error: tokensError
  } = useRewardContractTokens(contractAddress);

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
    rewardContractAddress: contractAddress,
    limit: 1
  });
  const mostRecentReward = historicRewardsTokenData?.[0];

  //Get the MKR price from the seal historic data endpoint, since that is used for the total seal TVL
  //and we want the farm TVLs to sum up to the total seal TVL
  const {
    data: sealHistoricData,
    isLoading: sealHistoricIsLoading,
    error: sealHistoricError
  } = useSealHistoricData();
  const mostRecentSealData = useMemo(
    () =>
      sealHistoricData?.sort((a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime())[0],
    [sealHistoricData]
  );
  const mkrPrice = mostRecentSealData?.mkrPrice ? Number(mostRecentSealData.mkrPrice) : 0;

  const totalSupplied = mostRecentReward?.totalSupplied ? parseFloat(mostRecentReward.totalSupplied) : 0;
  const totalSuppliedInDollars = !isNaN(totalSupplied) && !isNaN(mkrPrice) ? totalSupplied * mkrPrice : 0;

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
      {/* Removing this for now, will put back in once we have a way to get the rate */}
      {/* <StatsCard
        title={t`Rate`}
        isLoading={rateLoading}
        error={rateError}
        content={<Text className="mt-2">{rewardRate.formatted}</Text>}
      /> */}
      <StatsCard
        title={t`Total Value Locked`}
        isLoading={historicRewardsTokenIsLoading || sealHistoricIsLoading}
        error={historicRewardsTokenError || sealHistoricError}
        content={<Text className="mt-2">{`$${formatNumber(totalSuppliedInDollars)}`}</Text>}
      />
      <StatsCard
        title={t`Suppliers`}
        isLoading={historicRewardsTokenIsLoading}
        error={historicRewardsTokenError}
        content={<Text className="mt-2">{mostRecentReward?.suppliers || ''}</Text>}
      />
    </HStack>
  );
};

export function SealRewardsOverview() {
  const { data, isLoading, error } = useSaRewardContracts();

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
          <Trans>We couldn't load the Seal module rewards. Please try again later.</Trans>
        </Text>
      }
    >
      <VStack className="space-y-8">
        {data?.map(({ contractAddress }) => (
          <SealRewardsOverviewRow key={contractAddress} contractAddress={contractAddress} />
        ))}
      </VStack>
    </LoadingErrorWrapper>
  );
}
