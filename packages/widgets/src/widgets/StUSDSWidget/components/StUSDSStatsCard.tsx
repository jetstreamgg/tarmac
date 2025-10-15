import { formatBigInt, isTestnetId } from '@jetstreamgg/sky-utils';
import { t } from '@lingui/core/macro';
import { HStack } from '@widgets/shared/components/ui/layout/HStack';
import { MotionVStack } from '@widgets/shared/components/ui/layout/MotionVStack';
import { Text } from '@widgets/shared/components/ui/Typography';
import { Skeleton } from '@widgets/components/ui/skeleton';
import { StUSDSStatsCardCore } from './StUSDSStatsCardCore';
import { StatsAccordionCard } from '@widgets/shared/components/ui/card/StatsAccordionCard';
import { positionAnimations } from '@widgets/shared/animation/presets';
import { stUsdsAddress } from '@jetstreamgg/sky-hooks';
import { useChainId } from 'wagmi';
import { PopoverRateInfo } from '@widgets/shared/components/ui/PopoverRateInfo';

export type StUSDSStats = {
  totalAssets: bigint;
  userUsdsBalance: bigint;
  userStUsdsBalance?: bigint;
  availableLiquidityBuffered?: bigint;
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

  const availableLiquidityBuffered = stats.availableLiquidityBuffered || 0n;

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
        ) : isConnectedAndEnabled && stats.userUsdsBalance !== undefined ? (
          <Text dataTestId="supplied-balance" className="whitespace-nowrap">
            {formatBigInt(stats.userUsdsBalance || 0n, { unit: 18, compact: true })} USDS
            {stats.userStUsdsBalance !== undefined && (
              <span className="text-textSecondary ml-1 text-sm">
                ({formatBigInt(stats.userStUsdsBalance, { compact: true, maxDecimals: 2 })} stUSDS)
              </span>
            )}
          </Text>
        ) : (
          <Text>--</Text>
        )}
      </MotionVStack>
      <MotionVStack
        className="min-w-0 flex-1 items-end justify-between text-right"
        gap={2}
        variants={positionAnimations}
        data-testid="withdrawal-liquidity-container"
      >
        <div className="text-textSecondary flex items-center justify-end gap-1.5">
          <Text className="text-textSecondary whitespace-nowrap text-sm leading-4">{t`Available liquidity`}</Text>
          <PopoverRateInfo type="stusdsLiquidity" onExternalLinkClicked={onExternalLinkClicked} />
        </div>
        {isLoading ? (
          <div className="flex justify-end">
            <Skeleton className="bg-textSecondary h-6 w-20" />
          </div>
        ) : (
          <Text dataTestId="withdrawal-liquidity">
            {formatBigInt(availableLiquidityBuffered, { compact: true })} USDS
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
          accordionTitle="stUSDS info"
          accordionContent={accordionContent}
          onExternalLinkClicked={onExternalLinkClicked}
        />
      }
      onExternalLinkClicked={onExternalLinkClicked}
    />
  );
};
