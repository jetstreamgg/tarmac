import { useContext, useEffect } from 'react';
import {
  SavingsFlow,
  SavingsAction,
  SavingsScreen,
  getSavingsApproveSubtitle,
  supplySubtitle,
  withdrawSubtitle,
  savingsActionDescription,
  supplyLoadingButtonText,
  withdrawLoadingButtonText,
  savingsApproveTitle,
  savingsSupplyTitle,
  savingsWithdrawTitle
} from '../lib/constants';
import { TxCardCopyText } from '@/shared/types/txCardCopyText';
import { WidgetContext } from '@/context/WidgetContext';
import { TransactionStatus } from '@/shared/components/ui/transaction/TransactionStatus';
import { useLingui } from '@lingui/react';
import { t } from '@lingui/core/macro';
import { Token } from '@jetstreamgg/hooks';
import { formatBigInt } from '@jetstreamgg/utils';
import { approveLoadingButtonText } from '@/shared/constants';
import { getTokenDecimals } from '@jetstreamgg/hooks';
import { useChainId } from 'wagmi';
import { isL2ChainId } from '@jetstreamgg/utils';

// TX Status wrapper to update copy
export const SavingsTransactionStatus = ({
  originToken,
  originAmount,
  onExternalLinkClicked
}: {
  originAmount: bigint;
  originToken: Token;
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
}) => {
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
    if (flow === SavingsFlow.SUPPLY) setStepTwoTitle(t`Supply`);
    if (flow === SavingsFlow.WITHDRAW) setStepTwoTitle(t`Withdraw`);
    if (action === SavingsAction.APPROVE && screen === SavingsScreen.TRANSACTION) {
      setStep(1);
      setTxTitle(i18n._(savingsApproveTitle[txStatus as keyof TxCardCopyText]));
      setTxSubtitle(
        i18n._(
          getSavingsApproveSubtitle(
            txStatus,
            isL2ChainId(chainId) ? (flow === SavingsFlow.WITHDRAW ? 'sUSDS' : originToken.symbol) : 'USDS'
          )
        )
      );
      setTxDescription(i18n._(savingsActionDescription({ flow, action, txStatus })));
      setLoadingText(i18n._(approveLoadingButtonText[txStatus as keyof TxCardCopyText]));
    } else if (
      flow === SavingsFlow.SUPPLY &&
      action === SavingsAction.SUPPLY &&
      screen === SavingsScreen.TRANSACTION
    ) {
      setStep(2);
      setTxTitle(i18n._(savingsSupplyTitle[txStatus as keyof TxCardCopyText]));
      setTxSubtitle(
        i18n._(
          supplySubtitle({
            txStatus,
            amount: formatBigInt(originAmount, { unit: getTokenDecimals(originToken, chainId) }),
            symbol: originToken.symbol
          })
        )
      );
      setTxDescription(i18n._(savingsActionDescription({ flow, action, txStatus })));
      setLoadingText(
        i18n._(
          supplyLoadingButtonText({
            txStatus,
            amount: formatBigInt(originAmount, { unit: getTokenDecimals(originToken, chainId) }),
            symbol: originToken.symbol
          })
        )
      );
    } else if (
      flow === SavingsFlow.WITHDRAW &&
      action === SavingsAction.WITHDRAW &&
      screen === SavingsScreen.TRANSACTION
    ) {
      setStep(2);
      setTxTitle(i18n._(savingsWithdrawTitle[txStatus as keyof TxCardCopyText]));
      setTxSubtitle(
        i18n._(
          withdrawSubtitle({
            txStatus,
            amount: formatBigInt(originAmount, { unit: getTokenDecimals(originToken, chainId) }),
            symbol: originToken.symbol
          })
        )
      );
      setTxDescription(i18n._(savingsActionDescription({ flow, action, txStatus })));
      setLoadingText(
        i18n._(
          withdrawLoadingButtonText({
            txStatus,
            amount: formatBigInt(originAmount, { unit: getTokenDecimals(originToken, chainId) }),
            symbol: originToken.symbol
          })
        )
      );
    }
  }, [txStatus, flow, action, screen, i18n.locale]);
  return <TransactionStatus onExternalLinkClicked={onExternalLinkClicked} />;
};
