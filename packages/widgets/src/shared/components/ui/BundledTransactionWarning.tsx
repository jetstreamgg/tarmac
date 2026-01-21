import { motion } from 'framer-motion';
import { Text } from '@widgets/shared/components/ui/Typography';
import { InfoTooltip } from '@widgets/shared/components/ui/tooltip/InfoTooltip';
import { positionAnimations } from '@widgets/shared/animation/presets';
import { useIsBatchSupported } from '@jetstreamgg/sky-hooks';
import { useChainId, useConnection } from 'wagmi';
import { isTestnetId } from '@jetstreamgg/sky-utils';

/**
 * A reusable warning component for bundled transaction requirements
 * Used across widgets to inform users when features require bundled transaction support
 */
export function BundledTransactionWarning({ flowTitle }: { flowTitle: string }) {
  const chainId = useChainId();
  const { isLoading } = useIsBatchSupported();
  const { isConnected } = useConnection();

  if (isLoading || isTestnetId(chainId) || !isConnected) return null;

  return (
    <motion.div variants={positionAnimations}>
      <Text variant="medium" className="text-error px-4 pt-4">
        {flowTitle} is currently only offered as a bundled transaction.{' '}
        <InfoTooltip
          content={
            <Text className="text-textSecondary text-[13px]">
              This flow is currently only offered as a bundled transaction. Either enable bundled
              transactions, or switch to a wallet provider that supports the feature.
            </Text>
          }
          contentClassname="max-w-[300px]"
          iconClassName="text-error"
        />
      </Text>
    </motion.div>
  );
}
