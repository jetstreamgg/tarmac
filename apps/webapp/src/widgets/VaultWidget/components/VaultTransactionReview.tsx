import { Token, useIsBatchSupported } from '@/hooks';
import { t } from '@lingui/core/macro';
import { useLingui } from '@lingui/react/macro';
import { WidgetContext } from '@/widgets/context/WidgetContext';
import { TransactionReview } from '@/widgets/shared/components/ui/transaction/TransactionReview';
import { StepIndicator } from '@/widgets/shared/components/ui/transaction/StepIndicator';
import { BatchStatus, TxStatus } from '@/widgets/shared/constants';
import { motion } from 'motion/react';
import { positionAnimations } from '@/widgets/shared/animation/presets';
import {
  getMorphoVaultSupplyReviewSubtitle,
  getMorphoVaultWithdrawReviewSubtitle,
  morphoVaultActionDescription,
  VaultAction,
  VaultFlow,
  VaultScreen,
  morphoVaultSupplyReviewTitle,
  morphoVaultWithdrawReviewTitle
} from '../lib/constants';
import { useContext, useEffect } from 'react';

export const VaultTransactionReview = ({
  batchEnabled,
  setBatchEnabled,
  isBatchTransaction,
  assetToken,
  amount,
  needsAllowance,
  needsAllowanceReset,
  vaultLabel
}: {
  batchEnabled?: boolean;
  setBatchEnabled?: (enabled: boolean) => void;
  isBatchTransaction: boolean;
  assetToken: Token;
  amount: bigint;
  needsAllowance: boolean;
  needsAllowanceReset: boolean;
  /** How the vault is named in copy (e.g. "the Morpho Vault" or "Tether Savings") */
  vaultLabel: string;
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
  const flow = widgetState.flow as VaultFlow;
  const action = widgetState.action as VaultAction;
  const screen = widgetState.screen as VaultScreen;

  useEffect(() => {
    setOriginToken(assetToken);
    setOriginAmount(amount);
  }, [assetToken, amount, setOriginToken, setOriginAmount]);

  // Sets the title and subtitle of the card
  useEffect(() => {
    if (flow === VaultFlow.SUPPLY) {
      setStepTwoTitle(t`Supply`);
      setTxTitle(i18n._(morphoVaultSupplyReviewTitle));
      setTxSubtitle(
        i18n._(
          getMorphoVaultSupplyReviewSubtitle({
            batchStatus: !!batchSupported && batchEnabled ? BatchStatus.ENABLED : BatchStatus.DISABLED,
            symbol: assetToken.symbol,
            needsAllowance,
            vaultLabel
          })
        )
      );
    } else if (flow === VaultFlow.WITHDRAW) {
      setStepTwoTitle(t`Withdraw`);
      setTxTitle(i18n._(morphoVaultWithdrawReviewTitle));
      setTxSubtitle(
        i18n._(
          getMorphoVaultWithdrawReviewSubtitle({
            symbol: assetToken.symbol,
            vaultLabel
          })
        )
      );
    }
    setTxDescription(
      i18n._(morphoVaultActionDescription({ flow, action, txStatus, needsAllowance, vaultLabel }))
    );
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
    vaultLabel,
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
      customSteps={resetSteps}
    />
  );
};
