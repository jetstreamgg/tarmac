import { Trans } from '@lingui/react/macro';
import { useMorphoVaultRewards, WriteHook } from '@jetstreamgg/sky-hooks';
import { formatBigInt } from '@jetstreamgg/sky-utils';
import { Button } from '@widgets/components/ui/button';
import { Skeleton } from '@widgets/components/ui/skeleton';
import { positionAnimations } from '@widgets/shared/animation/presets';
import { motion } from 'framer-motion';

type MorphoVaultRewardsCardProps = {
  /** Vault contract address */
  vaultAddress: `0x${string}`;
  /** Whether user is connected and widget is enabled */
  isConnectedAndEnabled: boolean;
  /** Claim rewards hook from useMorphoVaultTransactions */
  claimRewards?: WriteHook;
  /** Whether rewards are loading */
  isRewardsLoading?: boolean;
  /** Whether there are claimable rewards */
  hasClaimableRewards?: boolean;
};

export const MorphoVaultRewardsCard = ({
  vaultAddress,
  isConnectedAndEnabled,
  claimRewards,
  isRewardsLoading,
  hasClaimableRewards
}: MorphoVaultRewardsCardProps) => {
  // Fetch rewards data for displaying the button text
  const { data: rewardsData } = useMorphoVaultRewards({
    vaultAddress
  });

  // Don't render if not connected or no rewards
  if (!isConnectedAndEnabled || (!isRewardsLoading && !hasClaimableRewards)) {
    return null;
  }

  // Build the claim button text showing all rewards
  const claimButtonText = rewardsData?.rewards
    .filter(r => r.pending > 0n)
    .map(r => `${formatBigInt(r.pending, { unit: r.tokenDecimals, maxDecimals: 2 })} ${r.tokenSymbol}`)
    .join(' + ');

  const canClaim = hasClaimableRewards && claimRewards?.prepared && !claimRewards?.isLoading;

  if (isRewardsLoading) {
    return (
      <motion.div variants={positionAnimations} className="mt-5">
        <Skeleton className="h-12 w-full rounded-xl" />
      </motion.div>
    );
  }

  return (
    <motion.div variants={positionAnimations} className="mt-5">
      <Button variant="secondary" onClick={claimRewards?.execute} disabled={!canClaim} className="w-full">
        {claimRewards?.isLoading ? <Trans>Claiming...</Trans> : <Trans>Claim {claimButtonText}</Trans>}
      </Button>
    </motion.div>
  );
};
