import { useChainId } from 'wagmi';
import { formatBigInt } from '@/utils';
import { t } from '@lingui/core/macro';
import { HStack } from '@/widgets/shared/components/ui/layout/HStack';
import { MotionVStack } from '@/widgets/shared/components/ui/layout/MotionVStack';
import { Text } from '@/widgets/shared/components/ui/Typography';
import { Skeleton } from '@/widgets/components/ui/skeleton';
import { StatsAccordionCard } from '@/widgets/shared/components/ui/card/StatsAccordionCard';
import { positionAnimations } from '@/widgets/shared/animation/presets';
import { VaultStatsCardCore } from './VaultStatsCardCore';
import type { VaultProvider } from '@/hooks';

type VaultStatsCardProps = {
  /** Whether data is loading */
  isLoading: boolean;
  /** Vault contract address */
  vaultAddress?: `0x${string}`;
  /** Display name for the vault */
  vaultName: string;
  /** Which provider operates the vault (branding). Defaults to Morpho. */
  provider?: VaultProvider;
  /** User's vault balance in underlying assets */
  vaultBalance?: bigint;
  /** User's vault share balance */
  userShares?: bigint;
  /** Vault TVL (total assets) */
  vaultTvl?: bigint;
  /** Underlying asset symbol */
  assetSymbol: string;
  /** Asset decimals for formatting */
  assetDecimals: number;
  /** Share decimals for formatting vault shares (typically 18) */
  shareDecimals: number;
  /** Whether user is connected and widget is enabled */
  isConnectedAndEnabled: boolean;
  /** Callback for external link clicks */
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
};

export const VaultStatsCard = ({
  isLoading,
  vaultAddress,
  vaultName,
  provider = 'morpho',
  vaultBalance,
  userShares,
  vaultTvl,
  assetSymbol,
  assetDecimals,
  shareDecimals,
  isConnectedAndEnabled,
  onExternalLinkClicked
}: VaultStatsCardProps) => {
  const chainId = useChainId();

  const accordionContent = (
    <HStack className="mt-5 justify-between" gap={2}>
      <MotionVStack
        className="justify-between"
        gap={2}
        variants={positionAnimations}
        data-testid="vault-balance-container"
      >
        <Text className="text-textSecondary text-sm leading-4">{t`Supplied balance`}</Text>
        {isLoading && isConnectedAndEnabled ? (
          <Skeleton className="bg-textSecondary h-6 w-20" />
        ) : isConnectedAndEnabled && vaultBalance !== undefined ? (
          <Text dataTestId="vault-balance" className="whitespace-nowrap">
            {formatBigInt(vaultBalance, { unit: assetDecimals, compact: true })} {assetSymbol}
            {userShares !== undefined && (
              <span className="text-textSecondary ml-1 text-sm">
                ({formatBigInt(userShares, { unit: shareDecimals, compact: true, maxDecimals: 2 })} shares)
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
        data-testid="vault-tvl-container"
      >
        <Text className="text-textSecondary text-sm leading-4">{t`TVL`}</Text>
        {isLoading ? (
          <div className="flex justify-end">
            <Skeleton className="bg-textSecondary h-6 w-20" />
          </div>
        ) : vaultTvl !== undefined ? (
          <Text dataTestId="vault-tvl">
            {formatBigInt(vaultTvl, { unit: assetDecimals, compact: true })} {assetSymbol}
          </Text>
        ) : (
          <Text>--</Text>
        )}
      </MotionVStack>
    </HStack>
  );

  return (
    <VaultStatsCardCore
      vaultName={vaultName}
      assetSymbol={assetSymbol}
      vaultAddress={vaultAddress}
      provider={provider}
      content={
        <StatsAccordionCard
          chainId={chainId}
          address={vaultAddress}
          accordionTitle="Vault info"
          accordionContent={accordionContent}
          onExternalLinkClicked={onExternalLinkClicked}
        />
      }
    />
  );
};
