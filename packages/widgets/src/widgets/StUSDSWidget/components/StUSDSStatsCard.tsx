import { formatBigInt, isTestnetId } from '@jetstreamgg/sky-utils';
import { t } from '@lingui/core/macro';
import { HStack } from '@widgets/shared/components/ui/layout/HStack';
import { MotionVStack } from '@widgets/shared/components/ui/layout/MotionVStack';
import { Text } from '@widgets/shared/components/ui/Typography';
import { Skeleton } from '@widgets/components/ui/skeleton';
import { StUSDSStatsCardCore } from './StUSDSStatsCardCore';
import { StatsAccordionCard } from '@widgets/shared/components/ui/card/StatsAccordionCard';
import { positionAnimations } from '@widgets/shared/animation/presets';
import { useCollateralData, getIlkName, stUsdsAddress } from '@jetstreamgg/sky-hooks';
import { useChainId } from 'wagmi';

export type StUSDSStats = {
  totalAssets: bigint;
  userUsdsBalance: bigint;
  availableLiquidity?: bigint;
  maxWithdraw?: bigint;
  maxDeposit?: bigint;
};

type StUSDSStatsProps = {
  isLoading: boolean;
  stats: StUSDSStats;
  isConnectedAndEnabled: boolean;
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
};

export const StUSDSStatsCard = ({
  isLoading,
  stats,
  isConnectedAndEnabled = true,
  onExternalLinkClicked
}: StUSDSStatsProps) => {
  const connectedChainId = useChainId();
  const chainId = isTestnetId(connectedChainId) ? 314310 : 1; // StUsds is only on mainnet / mainnet testnet
  const stUsdsContractAddress = stUsdsAddress[chainId as keyof typeof stUsdsAddress];

  // Get collateral data for available liquidity calculation
  const { data: collateralData, isLoading: isCollateralLoading } = useCollateralData(getIlkName(2));
  const totalStakingDebt = collateralData?.totalDaiDebt ?? 0n;

  // Calculate available liquidity
  const totalAssets = stats.totalAssets || 0n;
  const availableLiquidity = totalAssets > totalStakingDebt ? totalAssets - totalStakingDebt : 0n;

  const isFullyLoading = isLoading || isCollateralLoading;

  const accordionContent = (
    <HStack className="mt-5 justify-between" gap={2}>
      <MotionVStack
        className="justify-between"
        gap={2}
        variants={positionAnimations}
        data-testid="supplied-balance-container"
      >
        <Text className="text-textSecondary text-sm leading-4">{t`Supplied balance`}</Text>
        {isLoading ? (
          <Skeleton className="bg-textSecondary h-6 w-20" />
        ) : (
          <Text dataTestId="supplied-balance">
            {isConnectedAndEnabled && stats.userUsdsBalance !== undefined
              ? `${formatBigInt(stats.userUsdsBalance || 0n, { unit: 18, compact: true })} USDS`
              : '--'}
          </Text>
        )}
      </MotionVStack>
      <MotionVStack
        className="items-stretch justify-between text-right"
        gap={2}
        variants={positionAnimations}
        data-testid="withdrawal-liquidity-container"
      >
        <Text className="text-textSecondary text-sm leading-4">{t`Withdrawal liquidity`}</Text>
        {isFullyLoading ? (
          <div className="flex justify-end">
            <Skeleton className="bg-textSecondary h-6 w-20" />
          </div>
        ) : (
          <Text dataTestId="withdrawal-liquidity">
            {formatBigInt(availableLiquidity, { compact: true })} USDS
          </Text>
        )}
      </MotionVStack>
    </HStack>
  );

  return (
    <StUSDSStatsCardCore
      content={
        <StatsAccordionCard
          chainId={connectedChainId}
          address={stUsdsContractAddress}
          accordionTitle="StUSDS info"
          accordionContent={accordionContent}
          onExternalLinkClicked={onExternalLinkClicked}
        />
      }
      onExternalLinkClicked={onExternalLinkClicked}
    />
  );
};
