import { useState, useCallback } from 'react';
import { Text } from '@/modules/layout/components/Typography';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { TransactionModal, TransactionModalScreen } from '@/modules/ui/components/TransactionModal';
import { useBatchToggle } from '@/modules/ui/hooks/useBatchToggle';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import {
  useClaimSelectedRewards,
  useIsBatchSupported,
  TOKENS,
  type ClaimableReward
} from '@jetstreamgg/sky-hooks';
import { formatNumber } from '@jetstreamgg/sky-utils';
import { formatUnits } from 'viem';
import { MODULE_ICONS } from '../constants';

type ClaimRewardsModalProps = {
  open: boolean;
  onClose: () => void;
  selectedRewards: ClaimableReward[];
  onClaimSuccess: () => void;
};

export function ClaimRewardsModal({
  open,
  onClose,
  selectedRewards,
  onClaimSuccess
}: ClaimRewardsModalProps) {
  const [screen, setScreen] = useState<TransactionModalScreen>(TransactionModalScreen.REVIEW);
  const [txHash, setTxHash] = useState<string | undefined>();
  const [batchEnabled, setBatchEnabled] = useBatchToggle();

  const { data: isBatchSupported } = useIsBatchSupported();

  const calls = selectedRewards.map(r => r.call);

  const { execute, prepared, isLoading, error } = useClaimSelectedRewards({
    calls,
    shouldUseBatch: batchEnabled,
    enabled: open && screen !== TransactionModalScreen.SUCCESS,
    onMutate: () => setScreen(TransactionModalScreen.EXECUTING),
    onStart: () => {},
    onSuccess: (hash: string | undefined) => {
      setTxHash(hash);
      setScreen(TransactionModalScreen.SUCCESS);
      onClaimSuccess();
    },
    onError: (_error: Error, hash: string | undefined) => {
      setTxHash(hash);
      setScreen(TransactionModalScreen.ERROR);
    }
  });

  const handleClose = useCallback(() => {
    onClose();
    // Reset state after close animation
    setTimeout(() => {
      setScreen(TransactionModalScreen.REVIEW);
      setTxHash(undefined);
    }, 200);
  }, [onClose]);

  const handleRetry = useCallback(() => {
    setScreen(TransactionModalScreen.REVIEW);
    setTxHash(undefined);
  }, []);

  const showBatchToggle = !!isBatchSupported && calls.length > 1;

  const reviewContent = (
    <div className="flex flex-col gap-3">
      <Text variant="small" className="text-textSecondary">
        <Trans>You are claiming rewards from {selectedRewards.length} source(s):</Trans>
      </Text>
      <div className="flex flex-col gap-3">
        {selectedRewards.map(reward => {
          const token = TOKENS[reward.rewardTokenSymbol.toLowerCase()];
          const formattedAmount = formatNumber(
            parseFloat(formatUnits(reward.claimableAmount, reward.rewardTokenDecimals)),
            { maxDecimals: 4, compact: true }
          );

          return (
            <div key={reward.id} className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2">
                {MODULE_ICONS[reward.module] && (
                  <img src={MODULE_ICONS[reward.module]} alt={reward.module} className="h-5 w-5" />
                )}
                <div className="flex flex-col">
                  <Text variant="small" className="text-text">
                    {reward.module}
                  </Text>
                  {reward.moduleDetail && (
                    <Text variant="captionSm" className="text-textSecondary">
                      {reward.moduleDetail}
                    </Text>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {token && <TokenIcon token={token} width={20} className="h-5 w-5" />}
                <Text variant="small" className="text-text">
                  {formattedAmount} {reward.rewardTokenSymbol}
                </Text>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <TransactionModal
      open={open}
      onClose={handleClose}
      title={t`Claim Rewards`}
      execute={execute}
      prepared={prepared}
      isLoading={isLoading}
      error={error}
      txHash={txHash}
      screen={screen}
      batchEnabled={batchEnabled}
      setBatchEnabled={setBatchEnabled}
      showBatchToggle={showBatchToggle}
      reviewContent={reviewContent}
      successTitle={t`Rewards Claimed`}
      successDescription={t`Your rewards have been claimed successfully.`}
      onRetry={handleRetry}
    />
  );
}
