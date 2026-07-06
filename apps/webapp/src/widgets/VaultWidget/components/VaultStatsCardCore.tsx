import { StatsOverviewCardCore } from '@/widgets/shared/components/ui/card/StatsOverviewCardCore';
import { MotionHStack } from '@/widgets/shared/components/ui/layout/MotionHStack';
import { TokenIcon } from '@/widgets/shared/components/ui/token/TokenIcon';
import { Text } from '@/widgets/shared/components/ui/Typography';
import { positionAnimations } from '@/widgets/shared/animation/presets';
import { JSX } from 'react';
import { MorphoRateBreakdownPopover } from './MorphoRateBreakdownPopover';
import { SparkVaultRate } from './SparkVaultRate';
import { VaultPoweredByBadge } from './MorphoVaultBadge';
import type { VaultProvider } from '@/hooks';

type VaultStatsCardCoreProps = {
  /** Display name for the vault */
  vaultName: string;
  /** Underlying asset symbol for the token icon */
  assetSymbol: string;
  /** Address of the selected vault */
  vaultAddress?: `0x${string}`;
  /** Which provider operates the vault (branding + rate source). Defaults to Morpho. */
  provider?: VaultProvider;
  /** The accordion/collapsible content */
  content: JSX.Element;
};

export const VaultStatsCardCore = ({
  vaultName,
  assetSymbol,
  vaultAddress,
  provider = 'morpho',
  content
}: VaultStatsCardCoreProps) => {
  return (
    <StatsOverviewCardCore
      headerLeftContent={
        <MotionHStack className="items-center" gap={2} variants={positionAnimations}>
          <TokenIcon className="h-6 w-6" token={{ symbol: assetSymbol }} />
          <Text>{vaultName}</Text>
          <VaultPoweredByBadge provider={provider} />
        </MotionHStack>
      }
      headerRightContent={
        <MotionHStack className="items-center" gap={2} variants={positionAnimations}>
          {/* Rate: Morpho from its API, Spark from the on-chain Vault Savings Rate. */}
          {provider === 'morpho'
            ? vaultAddress && <MorphoRateBreakdownPopover vaultAddress={vaultAddress} />
            : vaultAddress && <SparkVaultRate vaultAddress={vaultAddress} />}
        </MotionHStack>
      }
      content={content}
      className="cursor-default"
    />
  );
};
