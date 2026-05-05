import { useContext, useEffect, useState } from 'react';
import {
  MorphoVaultFlow,
  MorphoVaultAction,
  MorphoVaultScreen,
  supplySubtitle,
  withdrawSubtitle,
  morphoVaultActionDescription,
  supplyLoadingButtonText,
  withdrawLoadingButtonText,
  morphoVaultSupplyTitle,
  morphoVaultWithdrawTitle
} from '../lib/constants';
import { TxCardCopyText } from '@widgets/shared/types/txCardCopyText';
import { WidgetContext } from '@widgets/context/WidgetContext';
import { BatchTransactionStatus } from '@widgets/shared/components/ui/transaction/BatchTransactionStatus';
import { StepIndicator } from '@widgets/shared/components/ui/transaction/StepIndicator';
import { useLingui } from '@lingui/react';
import { t } from '@lingui/core/macro';
import { Token, getTokenDecimals } from '@jetstreamgg/sky-hooks';
import { formatBigInt } from '@jetstreamgg/sky-utils';
import { useChainId } from 'wagmi';
import { TxStatus } from '@widgets/shared/constants';
import { motion } from 'motion/react';
import { positionAnimations } from '@widgets/shared/animation/presets';

export const MorphoVaultTransactionStatus = ({
  assetToken,
  amount,
  onExternalLinkClicked,
  isBatchTransaction,
  needsAllowance,
  needsAllowanceReset,
  currentCallIndex
}: {
  amount: bigint;
  assetToken: Token;
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
  isBatchTransaction?: boolean;
  needsAllowance: boolean;
  needsAllowanceReset: boolean;
  currentCallIndex: number;
}) => {
  // Capture at mount to avoid state changes during transaction
  const [flowNeedsAllowance] = useState(needsAllowance);
  const [flowNeedsAllowanceReset] = useState(needsAllowanceReset);
  const totalSteps = flowNeedsAllowanceReset ? 3 : 2;

  const { i18n } = useLingui();
  const chainId = useChainId();
  const {
    setLoadingText,
    setTxTitle,
    setTxSubtitle,
    setTxDescription,
    setOriginToken,
    setOriginAmount,
    setStep,
    setStepTwoTitle,
    stepTwoTitle,
    step,
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
    const isWaitingForSecondTransaction =
      txStatus === TxStatus.INITIALIZED &&
      action !== MorphoVaultAction.APPROVE &&
      flowNeedsAllowance &&
      !isBatchTransaction;
    const flowTxStatus: TxStatus = isWaitingForSecondTransaction ? TxStatus.LOADING : txStatus;

    const formattedAmount = formatBigInt(amount, { unit: getTokenDecimals(assetToken, chainId) });

    if (flow === MorphoVaultFlow.SUPPLY) {
      setStepTwoTitle(t`Supply`);

      if (screen === MorphoVaultScreen.TRANSACTION) {
        setTxTitle(i18n._(morphoVaultSupplyTitle[flowTxStatus as keyof TxCardCopyText]));
        setTxSubtitle(
          i18n._(
            supplySubtitle({
              txStatus: flowTxStatus,
              amount: formattedAmount,
              symbol: assetToken.symbol,
              needsAllowance: flowNeedsAllowance
            })
          )
        );
        setTxDescription(
          i18n._(
            morphoVaultActionDescription({
              flow,
              action,
              txStatus: flowTxStatus,
              needsAllowance: flowNeedsAllowance
            })
          )
        );
        setLoadingText(
          i18n._(
            supplyLoadingButtonText({
              txStatus: flowTxStatus,
              amount: formattedAmount,
              symbol: assetToken.symbol,
              action
            })
          )
        );

        if (isBatchTransaction || flowTxStatus === TxStatus.SUCCESS) {
          setStep(totalSteps);
        } else if (flowNeedsAllowance) {
          const candidateStep = currentCallIndex + 1;
          // Don't advance step while txStatus is stale from the previous transaction.
          // When currentCallIndex advances (previous tx mined), txStatus is still LOADING.
          // Wait until txStatus transitions away from LOADING (e.g. to INITIALIZED via onMutate)
          // before advancing step, to prevent the next step from briefly flashing as loading.
          if (candidateStep <= step || txStatus !== TxStatus.LOADING) {
            setStep(candidateStep);
          }
        } else {
          setStep(totalSteps);
        }
      }
    } else if (flow === MorphoVaultFlow.WITHDRAW) {
      setStepTwoTitle(t`Withdraw`);

      if (screen === MorphoVaultScreen.TRANSACTION) {
        setTxTitle(i18n._(morphoVaultWithdrawTitle[flowTxStatus as keyof TxCardCopyText]));
        setTxSubtitle(
          i18n._(
            withdrawSubtitle({
              txStatus: flowTxStatus,
              amount: formattedAmount,
              symbol: assetToken.symbol
            })
          )
        );
        setTxDescription(
          i18n._(
            morphoVaultActionDescription({
              flow,
              action,
              txStatus: flowTxStatus,
              needsAllowance: flowNeedsAllowance
            })
          )
        );
        setLoadingText(
          i18n._(
            withdrawLoadingButtonText({
              txStatus: flowTxStatus,
              amount: formattedAmount,
              symbol: assetToken.symbol
            })
          )
        );

        setStep(2);
      }
    }
  }, [
    txStatus,
    flow,
    action,
    screen,
    i18n.locale,
    flowNeedsAllowance,
    isBatchTransaction,
    amount,
    assetToken,
    chainId,
    i18n,
    setTxTitle,
    setTxSubtitle,
    setTxDescription,
    setLoadingText,
    setStep,
    setStepTwoTitle,
    currentCallIndex,
    totalSteps
  ]);

  const getStepTxStatus = (stepNumber: number) => {
    if (isBatchTransaction) return txStatus;
    if (step > stepNumber) return TxStatus.SUCCESS;
    if (step === stepNumber) return txStatus;
    return TxStatus.IDLE;
  };

  // Custom 3-step indicators for USDT allowance reset flow
  const resetSteps = flowNeedsAllowanceReset ? (
    <motion.div variants={positionAnimations} className="flex w-full flex-col pt-4">
      <StepIndicator
        stepNumber={1}
        currentStep={isBatchTransaction || step === 1}
        txStatus={getStepTxStatus(1)}
        text={t`Reset allowance`}
        className="flex-1"
        circleIndicator
      />
      <StepIndicator
        stepNumber={2}
        currentStep={isBatchTransaction || step === 2}
        txStatus={getStepTxStatus(2)}
        text={t`Approve`}
        className="flex-1"
        circleIndicator
      />
      <StepIndicator
        stepNumber={3}
        currentStep={isBatchTransaction || step === 3}
        txStatus={getStepTxStatus(3)}
        text={stepTwoTitle}
        className="flex-1"
        circleIndicator
      />
    </motion.div>
  ) : undefined;

  return (
    <BatchTransactionStatus
      onExternalLinkClicked={onExternalLinkClicked}
      isBatchTransaction={isBatchTransaction}
      customSteps={resetSteps}
      totalSteps={totalSteps}
    />
  );
};
