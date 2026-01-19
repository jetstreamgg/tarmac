import { useChainId } from 'wagmi';
import { formatBigInt } from '@jetstreamgg/sky-utils';
import { t } from '@lingui/core/macro';
import { HStack } from '@widgets/shared/components/ui/layout/HStack';
import { MotionVStack } from '@widgets/shared/components/ui/layout/MotionVStack';
import { Text } from '@widgets/shared/components/ui/Typography';
import { Skeleton } from '@widgets/components/ui/skeleton';
import { StatsAccordionCard } from '@widgets/shared/components/ui/card/StatsAccordionCard';
import { positionAnimations } from '@widgets/shared/animation/presets';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@widgets/components/ui/card';

type MorphoVaultStatsCardProps = {
  /** Whether data is loading */
  isLoading: boolean;
  /** Vault contract address */
  vaultAddress?: `0x${string}`;
  /** User's vault balance in underlying assets */
  vaultBalance?: bigint;
  /** Vault TVL (total assets) */
  vaultTvl?: bigint;
  /** Vault APY */
  vaultRate?: string;
  /** Underlying asset symbol */
  assetSymbol: string;
  /** Whether user is connected and widget is enabled */
  isConnectedAndEnabled: boolean;
  /** Callback for external link clicks */
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
};

export const MorphoVaultStatsCard = ({
  isLoading,
  vaultAddress,
  vaultBalance,
  vaultTvl,
  vaultRate,
  assetSymbol,
  isConnectedAndEnabled,
  onExternalLinkClicked
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
        <Text className="text-textSecondary text-sm leading-4">{t`Your balance`}</Text>
        {isLoading && isConnectedAndEnabled ? (
          <Skeleton className="bg-textSecondary h-6 w-10" />
        ) : isConnectedAndEnabled && vaultBalance !== undefined ? (
          <Text dataTestId="vault-balance">
            {formatBigInt(vaultBalance, { compact: true })} {assetSymbol}
          </Text>
        ) : (
          <Text>--</Text>
        )}
      </MotionVStack>

      {vaultRate && (
        <MotionVStack
          className="items-center justify-between"
          gap={2}
          variants={positionAnimations}
          data-testid="vault-rate-container"
        >
          <Text className="text-textSecondary text-sm leading-4">{t`Rate`}</Text>
          <Text dataTestId="vault-rate">{vaultRate}</Text>
        </MotionVStack>
      )}

      <MotionVStack
        className="items-stretch justify-between text-right"
        gap={2}
        variants={positionAnimations}
        data-testid="vault-tvl-container"
      >
        <Text className="text-textSecondary text-sm leading-4">{t`TVL`}</Text>
        {isLoading ? (
          <div className="flex justify-end">
            <Skeleton className="bg-textSecondary h-6 w-10" />
          </div>
        ) : vaultTvl !== undefined ? (
          <Text dataTestId="vault-tvl">
            {formatBigInt(vaultTvl, { compact: true })} {assetSymbol}
          </Text>
        ) : (
          <Text>--</Text>
        )}
      </MotionVStack>
    </HStack>
  );

  return (
    <motion.div variants={positionAnimations} className="mt-3">
      <Card variant="stats">
        <CardContent className="p-4">
          <StatsAccordionCard
            chainId={chainId}
            address={vaultAddress}
            accordionTitle="Vault info"
            accordionContent={accordionContent}
            onExternalLinkClicked={onExternalLinkClicked}
          />
        </CardContent>
      </Card>
    </motion.div>
  );
};
