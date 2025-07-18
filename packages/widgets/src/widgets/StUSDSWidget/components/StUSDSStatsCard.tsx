import { useChainId } from 'wagmi';
import { formatBigInt } from '@jetstreamgg/sky-utils';
import { t } from '@lingui/core/macro';
import { HStack } from '@widgets/shared/components/ui/layout/HStack';
import { MotionVStack } from '@widgets/shared/components/ui/layout/MotionVStack';
import { Text } from '@widgets/shared/components/ui/Typography';
import { Skeleton } from '@widgets/components/ui/skeleton';
import { StUSDSStatsCardCore } from './StUSDSStatsCardCore';
import { StatsAccordionCard } from '@widgets/shared/components/ui/card/StatsAccordionCard';
import { positionAnimations } from '@widgets/shared/animation/presets';
import { AlertCircle } from 'lucide-react';

export type StUSDSStats = {
  savingsTvl: bigint;
  savingsBalance: bigint;
};

type StUSDSStatsProps = {
  isLoading: boolean;
  address?: string;
  stats: StUSDSStats;
  isConnectedAndEnabled: boolean;
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
};

export const StUSDSStatsCard = ({
  isLoading,
  address,
  stats,
  isConnectedAndEnabled = true,
  onExternalLinkClicked
}: StUSDSStatsProps) => {
  const chainId = useChainId();

  // TODO: Replace with real stUSDS data when hooks are available
  const mockUtilization = 87;
  const mockTvl = 1800000000n * 10n ** 18n; // 1.8B USDS
  const isHighUtilization = mockUtilization > 90;
  const utilizationColor =
    mockUtilization > 90 ? 'text-error' : mockUtilization > 75 ? 'text-orange-400' : 'text-textSecondary';

  const accordionContent = (
    <div className="mt-5 space-y-4">
      <HStack className="justify-between" gap={2}>
        <MotionVStack
          className="justify-between"
          gap={2}
          variants={positionAnimations}
          data-testid="supplied-balance-container"
        >
          <Text className="text-textSecondary text-sm leading-4">{t`Supplied to stUSDS`}</Text>
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
          data-testid="tvl-container"
        >
          <Text className="text-textSecondary text-sm leading-4">{t`TVL`}</Text>
          {isLoading ? (
            <div className="flex justify-end">
              <Skeleton className="bg-textSecondary h-6 w-10" />
            </div>
          ) : (
            <Text dataTestId="stusds-tvl">{formatBigInt(mockTvl, { unit: 18, compact: true })} USDS</Text>
          )}
        </MotionVStack>
      </HStack>
      <MotionVStack gap={2} variants={positionAnimations} data-testid="utilization-container">
        <HStack className="justify-between">
          <Text className="text-textSecondary text-sm leading-4">{t`Utilization`}</Text>
          {isLoading ? (
            <Skeleton className="bg-textSecondary h-6 w-10" />
          ) : (
            <HStack className="items-center" gap={1}>
              <Text className={utilizationColor} dataTestId="stusds-utilization">
                {mockUtilization}%
              </Text>
              {isHighUtilization && <AlertCircle className="text-error h-4 w-4" />}
            </HStack>
          )}
        </HStack>
        <div className="w-full">
          <div className="bg-secondary h-[5px] overflow-hidden rounded-full">
            <div
              className={`h-full transition-all duration-300 ${
                mockUtilization > 90
                  ? 'bg-error'
                  : mockUtilization > 75
                    ? 'bg-orange-400'
                    : 'bg-textSecondary'
              }`}
              style={{ width: `${Math.min(mockUtilization, 100)}%` }}
            />
          </div>
        </div>
      </MotionVStack>
    </div>
  );

  return (
    <StUSDSStatsCardCore
      isLoading={isLoading}
      content={
        <StatsAccordionCard
          chainId={chainId}
          address={address}
          accordionTitle="stUSDS info"
          accordionContent={accordionContent}
          onExternalLinkClicked={onExternalLinkClicked}
        />
      }
      onExternalLinkClicked={onExternalLinkClicked}
    />
  );
};
