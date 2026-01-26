import { StatsOverviewCardCore } from '@widgets/shared/components/ui/card/StatsOverviewCardCore';
import { MotionHStack } from '@widgets/shared/components/ui/layout/MotionHStack';
import { TokenIcon } from '@widgets/shared/components/ui/token/TokenIcon';
import { Text } from '@widgets/shared/components/ui/Typography';
import { positionAnimations } from '@widgets/shared/animation/presets';
import { JSX } from 'react';
import { MorphoRateBreakdownPopover } from './MorphoRateBreakdownPopover';

type MorphoVaultStatsCardCoreProps = {
  /** Display name for the vault */
  vaultName: string;
  /** Underlying asset symbol for the token icon */
  assetSymbol: string;
  /** Address of the selected vault */
  vaultAddress?: `0x${string}`;
  /** The accordion/collapsible content */
  content: JSX.Element;
};

export const MorphoVaultStatsCardCore = ({
  vaultName,
  assetSymbol,
  vaultAddress,
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
          {vaultAddress && <MorphoRateBreakdownPopover vaultAddress={vaultAddress} />}
        </MotionHStack>
      }
      content={content}
      className="cursor-default"
    />
  );
};
