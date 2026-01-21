import { useContext, useEffect, useState } from 'react';
import {
  SavingsFlow,
  SavingsAction,
  SavingsScreen,
  supplySubtitle,
  withdrawSubtitle,
  savingsActionDescription,
  supplyLoadingButtonText,
  withdrawLoadingButtonText,
  savingsSupplyTitle,
  savingsWithdrawTitle
} from '../lib/constants';
import { TxCardCopyText } from '@widgets/shared/types/txCardCopyText';
import { WidgetContext } from '@widgets/context/WidgetContext';
import { BatchTransactionStatus } from '@widgets/shared/components/ui/transaction/BatchTransactionStatus';
import { useLingui } from '@lingui/react';
import { t } from '@lingui/core/macro';
import { Token } from '@jetstreamgg/sky-hooks';
import { formatBigInt, isL2ChainId } from '@jetstreamgg/sky-utils';
import { getTokenDecimals } from '@jetstreamgg/sky-hooks';
import { useChainId } from 'wagmi';
import { TxStatus } from '@widgets/shared/constants';
import { UpgradeAndSupplySteps } from './UpgradeAndSupplySteps';

// TX Status wrapper to update copy
export const SavingsTransactionStatus = ({
  originToken,
  originAmount,
  onExternalLinkClicked,
  isBatchTransaction,
  needsAllowance,
  isUpgradeSupplyFlow
}: {
  originAmount: bigint;
  originToken: Token;
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
  isBatchTransaction?: boolean;
  needsAllowance: boolean;
  isUpgradeSupplyFlow?: boolean;
}) => {
  const [flowNeedsAllowance] = useState(needsAllowance);

  const { i18n } = useLingui();
  const chainId = useChainId();
  const isL2Chain = isL2ChainId(chainId);
  const {
    setLoadingText,
    setTxTitle,
    setTxSubtitle,
    setTxDescription,
    setOriginToken,
    setOriginAmount,
    setStep,
    setStepTwoTitle,
    txStatus,
    widgetState
  } = useContext(WidgetContext);
  const { flow, action, screen } = widgetState;

  useEffect(() => {
    setOriginToken(originToken);
    setOriginAmount(originAmount);
  }, [originToken, originAmount]);

  // Sets the title and subtitle of the card
  useEffect(() => {
    const isWaitingForSecondTransaction =
      txStatus === TxStatus.INITIALIZED &&
      action !== SavingsAction.APPROVE &&
      flowNeedsAllowance &&
      !isBatchTransaction;
    const flowTxStatus: TxStatus = isWaitingForSecondTransaction ? TxStatus.LOADING : txStatus;

    if (flow === SavingsFlow.SUPPLY) {
      setStepTwoTitle(t`Supply`);

      if (screen === SavingsScreen.TRANSACTION) {
        setTxTitle(i18n._(savingsSupplyTitle[flowTxStatus as keyof TxCardCopyText]));
        setTxSubtitle(
          i18n._(
            supplySubtitle({
              txStatus: flowTxStatus,
              amount: formatBigInt(originAmount, { unit: getTokenDecimals(originToken, chainId) }),
              symbol: originToken.symbol,
              needsAllowance: flowNeedsAllowance
            })
          )
        );
        setTxDescription(
          i18n._(
            savingsActionDescription({
              flow,
              action,
              txStatus: flowTxStatus,
              needsAllowance: flowNeedsAllowance,
              isL2Chain
            })
          )
        );
        setLoadingText(
          i18n._(
            supplyLoadingButtonText({
              txStatus: flowTxStatus,
              amount: formatBigInt(originAmount, { unit: getTokenDecimals(originToken, chainId) }),
              symbol: originToken.symbol,
              action
            })
          )
        );

        if (isBatchTransaction) setStep(2);
        else if (flowTxStatus !== TxStatus.SUCCESS) {
          if (needsAllowance) setStep(1);
          else setStep(2);
        }
      }
    } else if (flow === SavingsFlow.WITHDRAW) {
      setStepTwoTitle(t`Withdraw`);

      if (screen === SavingsScreen.TRANSACTION) {
        setTxTitle(i18n._(savingsWithdrawTitle[flowTxStatus as keyof TxCardCopyText]));
        setTxSubtitle(
          i18n._(
            withdrawSubtitle({
              txStatus: flowTxStatus,
              amount: formatBigInt(originAmount, { unit: getTokenDecimals(originToken, chainId) }),
              symbol: isL2Chain ? 'sUSDS' : 'USDS',
              needsAllowance: flowNeedsAllowance,
              isL2Chain
            })
          )
        );
        setTxDescription(
          i18n._(
            savingsActionDescription({
              flow,
              action,
              txStatus: flowTxStatus,
              needsAllowance: flowNeedsAllowance,
              isL2Chain
            })
          )
        );
        setLoadingText(
          i18n._(
            withdrawLoadingButtonText({
              txStatus: flowTxStatus,
              amount: formatBigInt(originAmount, { unit: getTokenDecimals(originToken, chainId) }),
              symbol: originToken.symbol,
              action
            })
          )
        );

        setStep(2);
      }
    }
  }, [txStatus, flow, action, screen, i18n.locale, needsAllowance]);
  return (
    <BatchTransactionStatus
      onExternalLinkClicked={onExternalLinkClicked}
      isBatchTransaction={isBatchTransaction}
      customSteps={isUpgradeSupplyFlow ? <UpgradeAndSupplySteps /> : undefined}
    />
  );
};
