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
import { UtilizationBar } from '@widgets/shared/components/ui/UtilizationBar';
import { PopoverInfo } from '@widgets/shared/components/ui/PopoverInfo';

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
};

export const StUSDSStatsCard = ({
  isLoading,
  address,
  stats,
  utilizationRate = 0,
  isConnectedAndEnabled = true,
  onExternalLinkClicked
}: StUSDSStatsProps) => {
  const chainId = useChainId();

  const accordionContent = (
    <div className="mt-5 space-y-4">
      <HStack className="justify-between" gap={2}>
        <MotionVStack
          className="justify-between"
          gap={2}
          variants={positionAnimations}
          data-testid="supplied-balance-container"
        >
          <Text className="text-textSecondary text-sm leading-4">{t`Supplied balance`}</Text>
          {isLoading ? (
            <Skeleton className="bg-textSecondary h-6 w-10" />
          ) : isConnectedAndEnabled && stats?.userUsdsBalance !== undefined ? (
            <Text dataTestId="supplied-balance">
              {formatBigInt(stats.userUsdsBalance, { unit: 18, maxDecimals: 0 })} USDS
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
            <Text dataTestId="stusds-tvl">
              {formatBigInt(stats.totalAssets, { unit: 18, compact: true })} USDS
            </Text>
          )}
        </MotionVStack>
      </HStack>
      <MotionVStack gap={2} variants={positionAnimations} data-testid="utilization-container">
        <UtilizationBar
          utilizationRate={utilizationRate}
          isLoading={isLoading}
          label={t`Utilization`}
          dataTestId="stusds-utilization"
          popoverTitle={t`Vault Utilization`}
          popoverDescription={t`The percentage of vault capacity currently in use. High utilization may limit deposits and withdrawals. When utilization exceeds 90%, the vault approaches its operational limits.`}
        />
      </MotionVStack>
      {isConnectedAndEnabled && stats.maxDeposit !== undefined && (
        <MotionVStack gap={2} variants={positionAnimations} data-testid="max-deposit-container">
          <HStack className="justify-between">
            <HStack gap={1} className="items-center">
              <Text className="text-textSecondary text-sm leading-4">{t`Max deposit`}</Text>
              <PopoverInfo
                title={t`Max deposit`}
                description={t`The maximum amount of USDS you can deposit into the stUSDS vault. This limit is set by Sky Ecosystem Governance to manage risk and ensure protocol stability.`}
                iconClassName="text-textSecondary hover:text-white transition-colors"
                width={14}
                height={14}
              />
            </HStack>
            {isLoading ? (
              <Skeleton className="bg-textSecondary h-6 w-10" />
            ) : (
              <Text dataTestId="max-deposit" className={stats.maxDeposit === 0n ? 'text-warning' : ''}>
                {formatBigInt(stats.maxDeposit, { unit: 18, maxDecimals: 2, compact: true })} USDS
              </Text>
            )}
          </HStack>
          {stats.maxDeposit === 0n && (
            <Text className="text-warning text-xs">{t`Vault has reached its capacity limit`}</Text>
          )}
        </MotionVStack>
      )}
      {isConnectedAndEnabled && stats.maxWithdraw !== undefined && (
        <MotionVStack gap={2} variants={positionAnimations} data-testid="max-withdraw-container">
          <HStack className="justify-between">
            <HStack gap={1} className="items-center">
              <Text className="text-textSecondary text-sm leading-4">{t`Max withdrawable`}</Text>
              <PopoverInfo
                title={t`Max withdrawable`}
                description={t`The maximum amount of USDS you can withdraw from your stUSDS position. This is limited by your current balance and the available liquidity in the vault.`}
                iconClassName="text-textSecondary hover:text-white transition-colors"
                width={14}
                height={14}
              />
            </HStack>
            {isLoading ? (
              <Skeleton className="bg-textSecondary h-6 w-10" />
            ) : (
              <Text dataTestId="max-withdrawable" className={stats.maxWithdraw === 0n ? 'text-warning' : ''}>
                {formatBigInt(stats.maxWithdraw, { unit: 18, maxDecimals: 2, compact: true })} USDS
              </Text>
            )}
          </HStack>
          {stats.maxWithdraw === 0n && (
            <Text className="text-warning text-xs">
              {t`Vault has insufficient liquidity for withdrawals`}
            </Text>
          )}
        </MotionVStack>
      )}
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
    />
  );
};
