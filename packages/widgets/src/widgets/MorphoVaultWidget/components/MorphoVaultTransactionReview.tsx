import { Token, useIsBatchSupported } from '@jetstreamgg/sky-hooks';
import { t } from '@lingui/core/macro';
import { useLingui } from '@lingui/react/macro';
import { WidgetContext } from '@widgets/context/WidgetContext';
import { TransactionReview } from '@widgets/shared/components/ui/transaction/TransactionReview';
import { StepIndicator } from '@widgets/shared/components/ui/transaction/StepIndicator';
import { BatchStatus, TxStatus } from '@widgets/shared/constants';
import { motion } from 'motion/react';
import { positionAnimations } from '@widgets/shared/animation/presets';
import {
  getMorphoVaultSupplyReviewSubtitle,
  getMorphoVaultWithdrawReviewSubtitle,
  morphoVaultActionDescription,
  MorphoVaultFlow,
  morphoVaultSupplyReviewTitle,
  morphoVaultWithdrawReviewTitle
} from '../lib/constants';
import { useContext, useEffect } from 'react';

export const MorphoVaultTransactionReview = ({
  batchEnabled,
  setBatchEnabled,
  isBatchTransaction,
  assetToken,
  amount,
  needsAllowance,
  needsAllowanceReset,
  legalBatchTxUrl
}: {
  batchEnabled?: boolean;
  setBatchEnabled?: (enabled: boolean) => void;
  isBatchTransaction: boolean;
  assetToken: Token;
  amount: bigint;
  needsAllowance: boolean;
  needsAllowanceReset: boolean;
  legalBatchTxUrl?: string;
}) => {
  const { i18n } = useLingui();
  const { data: batchSupported } = useIsBatchSupported();
  const {
    setTxTitle,
    setTxSubtitle,
    setStepTwoTitle,
    stepTwoTitle,
    setOriginToken,
    setOriginAmount,
    setTxDescription,
    txStatus,
    widgetState
  } = useContext(WidgetContext);
  const { flow, action, screen } = widgetState;

  useEffect(() => {
    setOriginToken(assetToken);
    setOriginAmount(amount);
  }, [assetToken, amount, setOriginToken, setOriginAmount]);

  // Sets the title and subtitle of the card
  useEffect(() => {
    if (flow === MorphoVaultFlow.SUPPLY) {
      setStepTwoTitle(t`Supply`);
      setTxTitle(i18n._(morphoVaultSupplyReviewTitle));
      setTxSubtitle(
        i18n._(
          getMorphoVaultSupplyReviewSubtitle({
            batchStatus: !!batchSupported && batchEnabled ? BatchStatus.ENABLED : BatchStatus.DISABLED,
            symbol: assetToken.symbol,
            needsAllowance
          })
        )
      );
    } else if (flow === MorphoVaultFlow.WITHDRAW) {
      setStepTwoTitle(t`Withdraw`);
      setTxTitle(i18n._(morphoVaultWithdrawReviewTitle));
      setTxSubtitle(
        i18n._(
          getMorphoVaultWithdrawReviewSubtitle({
            symbol: assetToken.symbol
          })
        )
      );
    }
    setTxDescription(i18n._(morphoVaultActionDescription({ flow, action, txStatus, needsAllowance })));
  }, [
    flow,
    action,
    screen,
    i18n.locale,
    isBatchTransaction,
    batchSupported,
    batchEnabled,
    assetToken.symbol,
    needsAllowance,
    txStatus,
    setTxTitle,
    setTxSubtitle,
    setStepTwoTitle,
    setTxDescription,
    i18n
  ]);

  const resetSteps = needsAllowanceReset ? (
    <motion.div variants={positionAnimations} className="flex w-full flex-col pt-4">
      <StepIndicator
        stepNumber={1}
        currentStep={false}
        txStatus={TxStatus.IDLE}
        text={t`Reset allowance`}
        className="flex-1"
        circleIndicator
      />
      <StepIndicator
        stepNumber={2}
        currentStep={false}
        txStatus={TxStatus.IDLE}
        text={t`Approve`}
        className="flex-1"
        circleIndicator
      />
      <StepIndicator
        stepNumber={3}
        currentStep={false}
        txStatus={TxStatus.IDLE}
        text={stepTwoTitle}
        className="flex-1"
        circleIndicator
      />
    </motion.div>
  ) : undefined;

  return (
    <TransactionReview
      batchEnabled={batchEnabled}
      setBatchEnabled={setBatchEnabled}
      legalBatchTxUrl={legalBatchTxUrl}
      customSteps={resetSteps}
    />
  );
};
