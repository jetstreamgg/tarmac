import { Trans } from '@lingui/react/macro';
import { useMorphoVaultRewards, WriteHook } from '@jetstreamgg/sky-hooks';
import { formatBigInt } from '@jetstreamgg/sky-utils';
import { Button } from '@widgets/components/ui/button';
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
    .filter(r => r.amount > 0n)
    .map(r => `${formatBigInt(r.amount, { unit: r.tokenDecimals, maxDecimals: 2 })} ${r.tokenSymbol}`)
    .join(' + ');

  return (
    <motion.div
      variants={positionAnimations}
      className={`flex w-full justify-center ${!!claimButtonText && !!claimRewards ? 'mt-3' : ''}`}
    >
      {isConnectedAndEnabled && !!claimButtonText && !!claimRewards ? (
        <Button
          disabled={!claimRewards.prepared}
          onClick={claimRewards.execute}
          variant="secondary"
          className="w-full"
        >
          <Trans>Claim {claimButtonText}</Trans>
        </Button>
      ) : undefined}
    </motion.div>
  );
};
