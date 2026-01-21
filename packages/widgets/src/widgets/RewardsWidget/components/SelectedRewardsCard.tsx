import { Skeleton } from '@widgets/components/ui/skeleton';
import { HStack } from '@widgets/shared/components/ui/layout/HStack';
import { MotionVStack } from '@widgets/shared/components/ui/layout/MotionVStack';
import { Text } from '@widgets/shared/components/ui/Typography';
import {
  RewardContract,
  WriteHook,
  useRewardContractInfo,
  useRewardsSuppliedBalance
} from '@jetstreamgg/sky-hooks';
import { formatBigInt } from '@jetstreamgg/sky-utils';
import { t } from '@lingui/core/macro';
import { useConnection } from 'wagmi';
import { RewardsStatsCardCore } from './RewardsStatsCardCore';
import { StatsAccordionCard } from '@widgets/shared/components/ui/card/StatsAccordionCard'; // Import StatsAccordionCard
import { Warning } from '@widgets/shared/components/icons/Warning';
import { positionAnimations } from '@widgets/shared/animation/presets';

export const SelectedRewardsCard = ({
  rewardContract,
  rewardsBalance,
  claim,
  onClick,
  onClaimClick,
  isConnectedAndEnabled = true,
  onExternalLinkClicked
}: {
  rewardContract: RewardContract;
  rewardsBalance?: bigint;
  claim?: WriteHook;
  onClick?: (rewardContract: RewardContract) => void;
  onClaimClick?: () => void;
  isConnectedAndEnabled: boolean;
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
}) => {
  const { address } = useConnection();

  const { data, isLoading, error } = useRewardContractInfo({
    chainId: rewardContract.chainId,
    rewardContractAddress: rewardContract.contractAddress
  });

  // user's supplied balance
  const {
    data: suppliedBalance,
    isLoading: suppliedBalanceIsLoading,
    error: suppliedBalanceError
  } = useRewardsSuppliedBalance({
    chainId: rewardContract.chainId,
    address: address,
    contractAddress: rewardContract?.contractAddress as `0x${string}`
  });

  const accordionContent = (
    <HStack className="mt-5 justify-between" gap={2}>
      <MotionVStack className="justify-between" gap={2} variants={positionAnimations}>
        <Text className="text-textSecondary text-sm leading-4">{t`Supplied balance`}</Text>
        {suppliedBalanceIsLoading ? (
          <Skeleton className="bg-textSecondary h-6 w-10" />
        ) : isConnectedAndEnabled && suppliedBalance !== undefined ? (
          <Text>{formatBigInt(suppliedBalance, { maxDecimals: 0 })} USDS</Text>
        ) : suppliedBalanceError ? (
          <Warning boxSize={16} viewBox="0 0 16 16" />
        ) : (
          <Text>--</Text>
        )}
      </MotionVStack>
      <MotionVStack
        className="items-stretch justify-between text-right"
        gap={2}
        variants={positionAnimations}
      >
        <Text className="text-textSecondary text-sm leading-4">{t`TVL`}</Text>
        {isLoading ? (
          <div className="flex justify-end">
            <Skeleton className="bg-textSecondary h-6 w-10" />
          </div>
        ) : data ? (
          <Text>{formatBigInt(data.totalSupplied, { maxDecimals: 0 })} USDS</Text>
        ) : error ? (
          <Warning boxSize={16} viewBox="0 0 16 16" />
        ) : (
          <Text>--</Text>
        )}
      </MotionVStack>
    </HStack>
  );

  return (
    <RewardsStatsCardCore
      onClick={onClick}
      onClaimClick={onClaimClick}
      rewardContract={rewardContract}
      rewardsBalance={rewardsBalance}
      claim={claim}
      isConnectedAndEnabled={isConnectedAndEnabled}
      content={
        <StatsAccordionCard
          chainId={rewardContract.chainId}
          address={rewardContract.contractAddress}
          accordionTitle="Rewards info"
          accordionContent={accordionContent}
          onExternalLinkClicked={onExternalLinkClicked}
        />
      }
      className="cursor-default"
      onExternalLinkClicked={onExternalLinkClicked}
    />
  );
};
