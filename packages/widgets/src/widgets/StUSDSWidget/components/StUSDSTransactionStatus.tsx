import { useContext, useEffect, useState } from 'react';
import {
  StUSDSFlow,
  StUSDSAction,
  StUSDSScreen,
  stusdsSupplySubtitle,
  stusdsWithdrawSubtitle,
  stusdsActionDescription,
  stusdsSupplyLoadingButtonText,
  stusdsWithdrawLoadingButtonText,
  stusdsSupplyTitle,
  stusdsWithdrawTitle
} from '../lib/constants';
import { TxCardCopyText } from '@widgets/shared/types/txCardCopyText';
import { WidgetContext } from '@widgets/context/WidgetContext';
import { BatchTransactionStatus } from '@widgets/shared/components/ui/transaction/BatchTransactionStatus';
import { useLingui } from '@lingui/react';
import { t } from '@lingui/core/macro';
import { Token } from '@jetstreamgg/sky-hooks';
import { formatBigInt } from '@jetstreamgg/sky-utils';
import { getTokenDecimals } from '@jetstreamgg/sky-hooks';
import { useChainId } from 'wagmi';
import { TxStatus } from '@widgets/shared/constants';

// TX Status wrapper to update copy
export const StUSDSTransactionStatus = ({
  originToken,
  originAmount,
  onExternalLinkClicked,
  isBatchTransaction,
  needsAllowance,
  isCurve = false
}: {
  originAmount: bigint;
  originToken: Token;
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
  isBatchTransaction?: boolean;
  needsAllowance: boolean;
  isCurve?: boolean;
}) => {
  const [flowNeedsAllowance] = useState(needsAllowance);

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
      action !== StUSDSAction.APPROVE &&
      flowNeedsAllowance &&
      !isBatchTransaction;
    const flowTxStatus: TxStatus = isWaitingForSecondTransaction ? TxStatus.LOADING : txStatus;

    if (flow === StUSDSFlow.SUPPLY) {
      setStepTwoTitle(isCurve ? t`Swap` : t`Supply`);

      if (screen === StUSDSScreen.TRANSACTION) {
        setTxTitle(i18n._(stusdsSupplyTitle[flowTxStatus as keyof TxCardCopyText]));
        setTxSubtitle(
          i18n._(
            stusdsSupplySubtitle({
              txStatus: flowTxStatus,
              amount: formatBigInt(originAmount, { unit: getTokenDecimals(originToken, chainId) }),
              symbol: originToken.symbol,
              needsAllowance: flowNeedsAllowance,
              isCurve
            })
          )
        );
        setTxDescription(
          i18n._(
            stusdsActionDescription({
              flow,
              action,
              txStatus: flowTxStatus,
              needsAllowance: flowNeedsAllowance
            })
          )
        );
        setLoadingText(
          i18n._(
            stusdsSupplyLoadingButtonText({
              txStatus: flowTxStatus,
              amount: formatBigInt(originAmount, { unit: getTokenDecimals(originToken, chainId) }),
              symbol: originToken.symbol
            })
          )
        );

        if (isBatchTransaction) setStep(2);
        else if (flowTxStatus !== TxStatus.SUCCESS) {
          if (needsAllowance) setStep(1);
          else setStep(2);
        }
      }
    } else if (flow === StUSDSFlow.WITHDRAW) {
      setStepTwoTitle(isCurve ? t`Swap` : t`Withdraw`);

      if (screen === StUSDSScreen.TRANSACTION) {
        setTxTitle(i18n._(stusdsWithdrawTitle[flowTxStatus as keyof TxCardCopyText]));
        setTxSubtitle(
          i18n._(
            stusdsWithdrawSubtitle({
              txStatus: flowTxStatus,
              amount: formatBigInt(originAmount, { unit: getTokenDecimals(originToken, chainId) }),
              symbol: 'USDS',
              needsAllowance: flowNeedsAllowance,
              isCurve
            })
          )
        );
        setTxDescription(
          i18n._(
            stusdsActionDescription({
              flow,
              action,
              txStatus: flowTxStatus,
              needsAllowance: flowNeedsAllowance
            })
          )
        );
        setLoadingText(
          i18n._(
            stusdsWithdrawLoadingButtonText({
              txStatus: flowTxStatus,
              amount: formatBigInt(originAmount, { unit: getTokenDecimals(originToken, chainId) }),
              symbol: originToken.symbol
            })
          )
        );

        if (isBatchTransaction) setStep(2);
        else if (flowTxStatus !== TxStatus.SUCCESS) {
          if (needsAllowance) setStep(1);
          else setStep(2);
        }
      }
    }
  }, [
    txStatus,
    flow,
    action,
    screen,
    i18n.locale,
    needsAllowance,
    isCurve,
    originAmount,
    originToken,
    chainId,
    isBatchTransaction
  ]);
  return (
    <BatchTransactionStatus
      onExternalLinkClicked={onExternalLinkClicked}
      isBatchTransaction={isBatchTransaction}
    />
  );
};
