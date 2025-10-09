import { Skeleton } from '@widgets/components/ui/skeleton';
import { positionAnimations } from '@widgets/shared/animation/presets';
import { Warning } from '@widgets/shared/components/icons/Warning';
import { Text } from '@widgets/shared/components/ui/Typography';
import { StatsOverviewCardCoreAccordion } from '@widgets/shared/components/ui/card/StatsOverviewCardCoreAccordion';
import { HStack } from '@widgets/shared/components/ui/layout/HStack';
import { MotionHStack } from '@widgets/shared/components/ui/layout/MotionHStack';
import { MotionVStack } from '@widgets/shared/components/ui/layout/MotionVStack';
import { TokenIcon } from '@widgets/shared/components/ui/token/TokenIcon';
import { useRewardContractInfo, useRewardContractTokens, useSealRewardsData } from '@jetstreamgg/sky-hooks';
import { formatBigInt } from '@jetstreamgg/sky-utils';
import { t } from '@lingui/core/macro';
import { Dispatch, SetStateAction } from 'react';
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

  const { data: sealRewardsData, isLoading: isSealRewardsDataLoading } = useSealRewardsData();

  const contractRewardsData = sealRewardsData?.find(
    data => getAddress(data.address) === getAddress(contractAddress)
  );

  const handleSelectRewardContract = () => {
    setSelectedRewardContract?.(prevRewardContract =>
      prevRewardContract === contractAddress ? undefined : contractAddress
    );
  };

  return (
    <StatsOverviewCardCoreAccordion
      className={`transition-colors ${
        selectedRewardContract && getAddress(selectedRewardContract) === getAddress(contractAddress)
          ? 'bg-radial-(--gradient-position) from-primary-start/100 to-primary-end/100'
          : ''
      } ${setSelectedRewardContract ? 'cursor-pointer' : 'cursor-default'}`}
      headerLeftContent={
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
      }
      headerRightContent={
        <MotionHStack className="items-center" gap={2} variants={positionAnimations}>
          {contractRewardsData && contractRewardsData.rate > 0 ? (
            <div className="flex items-center gap-2">
              <Text className="text-bullish">{contractRewardsData.rate}% Rate</Text>
              <PopoverRateInfo type="srr" onExternalLinkClicked={onExternalLinkClicked} />
            </div>
          ) : isSealRewardsDataLoading ? (
            <Skeleton className="bg-textSecondary h-6 w-10" />
          ) : (
            ''
          )}
        </MotionHStack>
      }
      content={
        <HStack className="mt-5 justify-between" gap={2}>
          <MotionVStack className="justify-between" gap={2} variants={positionAnimations}>
            <Text className="text-textSecondary text-sm leading-4">{t`Total Value Locked`}</Text>
            {rewardContractInfo ? (
              <Text>{formatBigInt(rewardContractInfo.totalSupplied, { maxDecimals: 0 })} MKR</Text>
            ) : isRewardContractInfoLoading ? (
              <Skeleton className="bg-textSecondary h-5 w-10" />
            ) : rewardContractInfoError ? (
              <Warning boxSize={16} viewBox="0 0 16 16" />
            ) : null}
          </MotionVStack>
          <MotionVStack className="items-end justify-between" gap={2} variants={positionAnimations}>
            <Text className="text-textSecondary text-sm leading-4">{t`Suppliers`}</Text>
            {rewardContractInfo ? (
              <Text>{rewardContractInfo.suppliers.length}</Text>
            ) : isRewardContractInfoLoading ? (
              <Skeleton className="bg-textSecondary h-5 w-10" />
            ) : rewardContractInfoError ? (
              <Warning boxSize={16} viewBox="0 0 16 16" />
            ) : null}
          </MotionVStack>
        </HStack>
      }
      onClick={handleSelectRewardContract}
    />
  );
};
