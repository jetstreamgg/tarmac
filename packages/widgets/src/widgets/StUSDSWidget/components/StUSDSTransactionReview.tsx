import { Token, useIsBatchSupported } from '@jetstreamgg/sky-hooks';
import { t } from '@lingui/core/macro';
import { useLingui } from '@lingui/react/macro';
import { WidgetContext } from '@widgets/context/WidgetContext';
import { TransactionReview } from '@widgets/shared/components/ui/transaction/TransactionReview';
import { BatchStatus } from '@widgets/shared/constants';
import {
  getStUSDSSupplyReviewSubtitle,
  getStUSDSWithdrawReviewSubtitle,
  stusdsActionDescription,
  StUSDSFlow,
  stusdsSupplyReviewTitle,
  stusdsWithdrawReviewTitle
} from '../lib/constants';
import { useContext, useEffect } from 'react';

export const StUSDSTransactionReview = ({
  batchEnabled,
  setBatchEnabled,
  isBatchTransaction,
  originToken,
  originAmount,
  needsAllowance
}: {
  batchEnabled?: boolean;
  setBatchEnabled?: (enabled: boolean) => void;
  isBatchTransaction: boolean;
  originToken: Token;
  originAmount: bigint;
  needsAllowance: boolean;
}) => {
  const { i18n } = useLingui();
  const { data: batchSupported } = useIsBatchSupported();
  const {
    setTxTitle,
    setTxSubtitle,
    setStepTwoTitle,
    setOriginToken,
    setOriginAmount,
    setTxDescription,
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
    if (flow === StUSDSFlow.SUPPLY) {
      setStepTwoTitle(t`Supply`);
      setTxTitle(i18n._(stusdsSupplyReviewTitle));
      setTxSubtitle(
        i18n._(
          getStUSDSSupplyReviewSubtitle({
            batchStatus: !!batchSupported && batchEnabled ? BatchStatus.ENABLED : BatchStatus.DISABLED,
            symbol: originToken.symbol,
            needsAllowance
          })
        )
      );
    } else if (flow === StUSDSFlow.WITHDRAW) {
      setStepTwoTitle(t`Withdraw`);
      setTxTitle(i18n._(stusdsWithdrawReviewTitle));
      setTxSubtitle(
        i18n._(
          getStUSDSWithdrawReviewSubtitle({
            batchStatus: !!batchSupported && batchEnabled ? BatchStatus.ENABLED : BatchStatus.DISABLED,
            symbol: 'USDS',
            needsAllowance
          })
        )
      );
    }
    setTxDescription(i18n._(stusdsActionDescription({ flow, action, txStatus, needsAllowance })));
  }, [flow, action, screen, i18n.locale, isBatchTransaction, batchSupported, batchEnabled]);

  return <TransactionReview batchEnabled={batchEnabled} setBatchEnabled={setBatchEnabled} />;
};
