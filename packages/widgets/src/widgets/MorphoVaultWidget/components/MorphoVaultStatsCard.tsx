import { useChainId } from 'wagmi';
import { formatBigInt } from '@jetstreamgg/sky-utils';
import { WriteHook } from '@jetstreamgg/sky-hooks';
import { t } from '@lingui/core/macro';
import { HStack } from '@widgets/shared/components/ui/layout/HStack';
import { MotionVStack } from '@widgets/shared/components/ui/layout/MotionVStack';
import { Text } from '@widgets/shared/components/ui/Typography';
import { Skeleton } from '@widgets/components/ui/skeleton';
import { StatsAccordionCard } from '@widgets/shared/components/ui/card/StatsAccordionCard';
import { positionAnimations } from '@widgets/shared/animation/presets';
import { MorphoVaultStatsCardCore } from './MorphoVaultStatsCardCore';
import { MorphoVaultRewardsCard } from './MorphoVaultRewardsCard';

type MorphoVaultStatsCardProps = {
  /** Whether data is loading */
  isLoading: boolean;
  /** Vault contract address */
  vaultAddress?: `0x${string}`;
  /** Display name for the vault */
  vaultName: string;
  /** User's vault balance in underlying assets */
  vaultBalance?: bigint;
  /** User's vault share balance */
  userShares?: bigint;
  /** Vault TVL (total assets) */
  vaultTvl?: bigint;
  /** Vault rate formatted string (e.g., "3.44%") */
  vaultRate?: string;
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
  /** Claim rewards hook */
  claimRewards?: WriteHook;
  /** Whether rewards are loading */
  isRewardsLoading?: boolean;
  /** Whether there are claimable rewards */
  hasClaimableRewards?: boolean;
};

export const MorphoVaultStatsCard = ({
  isLoading,
  vaultAddress,
  vaultName,
  vaultBalance,
  userShares,
  vaultTvl,
  vaultRate,
  assetSymbol,
  assetDecimals,
  shareDecimals,
  isConnectedAndEnabled,
  onExternalLinkClicked,
  claimRewards,
  isRewardsLoading,
  hasClaimableRewards
}: MorphoVaultStatsCardProps) => {
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
    <MorphoVaultStatsCardCore
      vaultName={vaultName}
      assetSymbol={assetSymbol}
      vaultRate={vaultRate}
      isLoading={isLoading}
      content={
        <>
          <StatsAccordionCard
            chainId={chainId}
            address={vaultAddress}
            accordionTitle="Vault info"
            accordionContent={accordionContent}
            onExternalLinkClicked={onExternalLinkClicked}
          />
          {vaultAddress && (
            <MorphoVaultRewardsCard
              vaultAddress={vaultAddress}
              isConnectedAndEnabled={isConnectedAndEnabled}
              claimRewards={claimRewards}
              isRewardsLoading={isRewardsLoading}
              hasClaimableRewards={hasClaimableRewards}
            />
          )}
        </>
      }
    />
  );
};
