import { StatsOverviewCardCore } from '@widgets/shared/components/ui/card/StatsOverviewCardCore';
import { MotionHStack } from '@widgets/shared/components/ui/layout/MotionHStack';
import { TokenIcon } from '@widgets/shared/components/ui/token/TokenIcon';
import { Text } from '@widgets/shared/components/ui/Typography';
import { Skeleton } from '@widgets/components/ui/skeleton';
import { positionAnimations } from '@widgets/shared/animation/presets';
import { JSX } from 'react';

type MorphoVaultStatsCardCoreProps = {
  /** Display name for the vault */
  vaultName: string;
  /** Underlying asset symbol for the token icon */
  assetSymbol: string;
  /** Formatted vault rate string (e.g., "3.44%") */
  vaultRate?: string;
  /** Whether rate data is loading */
  isLoading: boolean;
  /** The accordion/collapsible content */
  content: JSX.Element;
};

export const MorphoVaultStatsCardCore = ({
  vaultName,
  assetSymbol,
  vaultRate,
  isLoading,
  content
}: MorphoVaultStatsCardCoreProps) => {
  return (
    <StatsOverviewCardCore
      headerLeftContent={
        <MotionHStack className="items-center" gap={2} variants={positionAnimations}>
          <TokenIcon className="h-6 w-6" token={{ symbol: assetSymbol }} />
          <Text>{vaultName}</Text>
        </MotionHStack>
      }
      headerRightContent={
        <MotionHStack className="items-center" gap={2} variants={positionAnimations}>
          {isLoading ? (
            <Skeleton className="bg-textSecondary h-5 w-12" />
          ) : (
            <Text className="text-bullish">{vaultRate ? `Rate: ${vaultRate}` : 'Rate: --'}</Text>
          )}
        </MotionHStack>
      }
      content={content}
      className="cursor-default"
    />
  );
};
