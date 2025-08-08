import { formatBigInt } from '@jetstreamgg/sky-utils';
import { t } from '@lingui/core/macro';
import { HStack } from '@widgets/shared/components/ui/layout/HStack';
import { MotionVStack } from '@widgets/shared/components/ui/layout/MotionVStack';
import { VStack } from '@widgets/shared/components/ui/layout/VStack';
import { Text } from '@widgets/shared/components/ui/Typography';
import { Skeleton } from '@widgets/components/ui/skeleton';
import { StUSDSStatsCardCore } from './StUSDSStatsCardCore';
import { positionAnimations } from '@widgets/shared/animation/presets';
import { useStUsdsCapacityData, useCollateralData, getIlkName } from '@jetstreamgg/sky-hooks';

export type StUSDSStats = {
  totalAssets: bigint;
  userUsdsBalance: bigint;
  availableLiquidity?: bigint;
  maxWithdraw?: bigint;
  maxDeposit?: bigint;
};

type StUSDSStatsProps = {
  isLoading: boolean;
  address?: string;
  stats: StUSDSStats;
  utilizationRate?: number;
  isConnectedAndEnabled: boolean;
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
  walletUsdsBalance?: bigint;
};

export const StUSDSStatsCard = ({
  isLoading,
  stats,
  isConnectedAndEnabled = true,
  walletUsdsBalance
}: StUSDSStatsProps) => {
  // Get capacity data
  const { data: capacityData, isLoading: isLoadingCapacity } = useStUsdsCapacityData();

  // Get collateral data for available liquidity calculation
  const { data: collateralData, isLoading: isCollateralLoading } = useCollateralData(getIlkName(2));
  const totalStakingDebt = collateralData?.totalDaiDebt ?? 0n;

  // Calculate remaining capacity
  const maxCapacity = capacityData?.maxCapacity || 0n;
  const totalAssets = stats.totalAssets || 0n;
  const remainingCapacity = maxCapacity > totalAssets ? maxCapacity - totalAssets : 0n;

  // Calculate available liquidity
  const availableLiquidity = totalAssets > totalStakingDebt ? totalAssets - totalStakingDebt : 0n;

  const isFullyLoading = isLoading || isLoadingCapacity || isCollateralLoading;

  return (
    <StUSDSStatsCardCore
      isLoading={false}
      content={
        <VStack className="w-full" gap={4}>
          <HStack className="justify-between" gap={2}>
            <MotionVStack
              className="justify-between"
              gap={2}
              variants={positionAnimations}
              data-testid="remaining-capacity-container"
            >
              <Text className="text-textSecondary text-sm leading-4">{t`Supply capacity`}</Text>
              {isFullyLoading ? (
                <Skeleton className="bg-textSecondary h-6 w-20" />
              ) : (
                <Text dataTestId="remaining-capacity">
                  {formatBigInt(remainingCapacity, { unit: 18, compact: true })} USDS
                </Text>
              )}
            </MotionVStack>
            <MotionVStack
              className="items-stretch justify-between text-right"
              gap={2}
              variants={positionAnimations}
              data-testid="available-liquidity-container"
            >
              <Text className="text-textSecondary text-sm leading-4">{t`Withdrawal liquidity`}</Text>
              {isFullyLoading ? (
                <div className="flex justify-end">
                  <Skeleton className="bg-textSecondary h-6 w-20" />
                </div>
              ) : (
                <Text dataTestId="available-liquidity">
                  {formatBigInt(availableLiquidity, { compact: true })} USDS
                </Text>
              )}
            </MotionVStack>
          </HStack>
          <HStack className="justify-between" gap={2}>
            <MotionVStack
              className="justify-between"
              gap={2}
              variants={positionAnimations}
              data-testid="usds-balance-container"
            >
              <Text className="text-textSecondary text-sm leading-4">{t`USDS balance`}</Text>
              {isLoading ? (
                <Skeleton className="bg-textSecondary h-6 w-20" />
              ) : (
                <Text dataTestId="usds-balance">
                  {isConnectedAndEnabled && walletUsdsBalance !== undefined
                    ? `${formatBigInt(walletUsdsBalance, { unit: 18, compact: true })} USDS`
                    : '--'}
                </Text>
              )}
            </MotionVStack>
            <MotionVStack
              className="items-stretch justify-between text-right"
              gap={2}
              variants={positionAnimations}
              data-testid="supplied-balance-container"
            >
              <Text className="text-textSecondary text-sm leading-4">{t`Supplied balance`}</Text>
              {isLoading ? (
                <div className="flex justify-end">
                  <Skeleton className="bg-textSecondary h-6 w-20" />
                </div>
              ) : (
                <Text dataTestId="supplied-balance">
                  {isConnectedAndEnabled && stats.userUsdsBalance !== undefined
                    ? `${formatBigInt(stats.userUsdsBalance || 0n, { unit: 18, compact: true })} USDS`
                    : '--'}
                </Text>
              )}
            </MotionVStack>
          </HStack>
        </VStack>
      }
    />
  );
};
