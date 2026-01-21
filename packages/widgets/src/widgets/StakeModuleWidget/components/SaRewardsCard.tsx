import { Skeleton } from '@widgets/components/ui/skeleton';
import { positionAnimations } from '@widgets/shared/animation/presets';
import { Warning } from '@widgets/shared/components/icons/Warning';
import { Text } from '@widgets/shared/components/ui/Typography';
import { Card, CardHeader, CardContent } from '@widgets/components/ui/card';
import { HStack } from '@widgets/shared/components/ui/layout/HStack';
import { MotionHStack } from '@widgets/shared/components/ui/layout/MotionHStack';
import { MotionVStack } from '@widgets/shared/components/ui/layout/MotionVStack';
import { TokenIcon } from '@widgets/shared/components/ui/token/TokenIcon';
import { useRewardContractInfo, useRewardContractTokens, useRewardsChartInfo } from '@jetstreamgg/sky-hooks';
import { formatBigInt, formatDecimalPercentage } from '@jetstreamgg/sky-utils';
import { t } from '@lingui/core/macro';
import { Dispatch, SetStateAction, useMemo } from 'react';
import { useChainId } from 'wagmi';
import { PopoverRateInfo } from '@widgets/shared/components/ui/PopoverRateInfo';
import { getAddress } from 'viem';

export const SaRewardsCard = ({
  contractAddress,
  selectedRewardContract,
  setSelectedRewardContract,
  onExternalLinkClicked
}: {
  contractAddress: `0x${string}`;
  selectedRewardContract?: `0x${string}` | undefined;
  setSelectedRewardContract?: Dispatch<SetStateAction<`0x${string}` | undefined>>;
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
}) => {
  const chainId = useChainId();
  const {
    data: rewardContractInfo,
    isLoading: isRewardContractInfoLoading,
    error: rewardContractInfoError
  } = useRewardContractInfo({
    rewardContractAddress: contractAddress,
    chainId
  });

  const {
    data: rewardContractTokens,
    isLoading: isRewardContractTokensLoading,
    error: rewardContractTokensError
  } = useRewardContractTokens(contractAddress);

  const { data: rewardsChartInfoData, isLoading: isRewardsChartInfoLoading } = useRewardsChartInfo({
    rewardContractAddress: contractAddress
  });

  const mostRecentRewardsChartInfoData = useMemo(
    () => rewardsChartInfoData?.slice().sort((a, b) => b.blockTimestamp - a.blockTimestamp)[0],
    [rewardsChartInfoData]
  );

  const handleSelectRewardContract = () => {
    setSelectedRewardContract?.(prevRewardContract =>
      prevRewardContract === contractAddress ? undefined : contractAddress
    );
  };

  return (
    <Card
      variant="pool"
      onClick={handleSelectRewardContract}
      className={`hover-in-before overflow-hidden bg-radial-(--gradient-position) transition-colors ${
        selectedRewardContract && getAddress(selectedRewardContract) === getAddress(contractAddress)
          ? 'from-primary-start/100 to-primary-end/100'
          : 'from-card to-card hover:from-primary-start/40 hover:to-primary-end/40'
      } ${setSelectedRewardContract ? 'cursor-pointer' : 'cursor-default'}`}
      data-testid="stake-reward-card"
    >
      <CardHeader>
        <HStack className="w-full justify-between">
          <MotionHStack className="items-center" gap={2} variants={positionAnimations}>
            {rewardContractTokens ? (
              <>
                <TokenIcon token={rewardContractTokens.rewardsToken} className="h-6 w-6" />
                <Text>{rewardContractTokens.rewardsToken.symbol}</Text>
              </>
            ) : isRewardContractTokensLoading ? (
              <>
                <Skeleton className="bg-textSecondary h-6 w-6 rounded-full" />
                <Skeleton className="bg-textSecondary h-5 w-10" />
              </>
            ) : rewardContractTokensError ? (
              <Warning boxSize={16} viewBox="0 0 16 16" />
            ) : null}
          </MotionHStack>
          <MotionHStack className="items-center" gap={2} variants={positionAnimations}>
            {mostRecentRewardsChartInfoData && parseFloat(mostRecentRewardsChartInfoData.rate) > 0 ? (
              <div className="flex items-center gap-2">
                <Text className="text-bullish">
                  {formatDecimalPercentage(parseFloat(mostRecentRewardsChartInfoData.rate))} Rate
                </Text>
                <PopoverRateInfo type="srr" onExternalLinkClicked={onExternalLinkClicked} />
              </div>
            ) : isRewardsChartInfoLoading ? (
              <Skeleton className="bg-textSecondary h-6 w-10" />
            ) : (
              <></>
            )}
          </MotionHStack>
        </HStack>
      </CardHeader>
      <CardContent className="pt-5">
        <HStack className="justify-between" gap={2}>
          <MotionVStack className="justify-between" gap={2} variants={positionAnimations}>
            <Text className="text-textSecondary text-sm leading-4">{t`TVL`}</Text>
            {rewardContractInfo ? (
              <Text>{formatBigInt(rewardContractInfo.totalSupplied, { maxDecimals: 0 })} SKY</Text>
            ) : isRewardContractInfoLoading ? (
              <Skeleton className="bg-textSecondary h-5 w-10" />
            ) : rewardContractInfoError ? (
              <Warning boxSize={16} viewBox="0 0 16 16" />
            ) : null}
          </MotionVStack>
          <MotionVStack className="items-end justify-between" gap={2} variants={positionAnimations}>
            <Text className="text-textSecondary text-sm leading-4">{t`Suppliers`}</Text>
            {mostRecentRewardsChartInfoData ? (
              <Text>{mostRecentRewardsChartInfoData.suppliers}</Text>
            ) : isRewardsChartInfoLoading ? (
              <Skeleton className="bg-textSecondary h-5 w-10" />
            ) : mostRecentRewardsChartInfoData ? (
              <Warning boxSize={16} viewBox="0 0 16 16" />
            ) : null}
          </MotionVStack>
        </HStack>
      </CardContent>
    </Card>
  );
};
