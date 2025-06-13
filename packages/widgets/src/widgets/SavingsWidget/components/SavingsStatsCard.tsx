import { useChainId } from 'wagmi';
import { formatBigInt, formatNumber } from '@jetstreamgg/sky-utils';
import { t } from '@lingui/core/macro';
import { HStack } from '@widgets/shared/components/ui/layout/HStack';
import { MotionVStack } from '@widgets/shared/components/ui/layout/MotionVStack';
import { Text } from '@widgets/shared/components/ui/Typography';
import { Skeleton } from '@widgets/components/ui/skeleton';
import { SavingsStatsCardCore } from './SavingsStatsCardCore';
import { StatsAccordionCard } from '@widgets/shared/components/ui/card/StatsAccordionCard'; // Import StatsAccordionCard
import { positionAnimations } from '@widgets/shared/animation/presets';
import { useOverallSkyData } from '@jetstreamgg/sky-hooks';

export type SavingsStats = {
  savingsTvl: bigint;
  savingsBalance: bigint;
};

type SavingsStatsProps = {
  isLoading: boolean;
  address?: string;
  stats: SavingsStats;
  isConnectedAndEnabled: boolean;
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
};

export const SavingsStatsCard = ({
  isLoading,
  address,
  stats,
  isConnectedAndEnabled = true,
  onExternalLinkClicked
}: SavingsStatsProps) => {
  const chainId = useChainId();
  const { data: overallData, isLoading: isOverallDataLoading } = useOverallSkyData();

  const accordionContent = (
    <HStack className="mt-5 justify-between" gap={2}>
      <MotionVStack
        className="justify-between"
        gap={2}
        variants={positionAnimations}
        data-testid="supplied-balance-container"
      >
        <Text className="text-textSecondary text-sm leading-4">{t`Savings balance`}</Text>
        {isLoading ? (
          <Skeleton className="bg-textSecondary h-6 w-10" />
        ) : isConnectedAndEnabled && stats?.savingsBalance !== undefined ? (
          <Text dataTestId="supplied-balance">
            {formatBigInt(stats.savingsBalance, { compact: true })} USDS
          </Text>
        ) : (
          <Text>--</Text>
        )}
      </MotionVStack>
      <MotionVStack
        className="items-stretch justify-between text-right"
        gap={2}
        variants={positionAnimations}
        data-testid="savings-tvl-container"
      >
        <Text className="text-textSecondary text-sm leading-4">{t`TVL`}</Text>
        {isOverallDataLoading ? (
          <div className="flex justify-end">
            <Skeleton className="bg-textSecondary h-6 w-10" />
          </div>
        ) : overallData?.totalSavingsTvl ? (
          <Text dataTestId="savings-tvl">
            {formatNumber(parseFloat(overallData.totalSavingsTvl), { compact: true })} USDS
          </Text>
        ) : (
          <Text>--</Text>
        )}
      </MotionVStack>
    </HStack>
  );

  return (
    <SavingsStatsCardCore
      isLoading={isLoading}
      content={
        <StatsAccordionCard
          chainId={chainId}
          address={address}
          accordionTitle="Savings info"
          accordionContent={accordionContent}
          onExternalLinkClicked={onExternalLinkClicked}
        />
      }
      onExternalLinkClicked={onExternalLinkClicked}
    />
  );
};
