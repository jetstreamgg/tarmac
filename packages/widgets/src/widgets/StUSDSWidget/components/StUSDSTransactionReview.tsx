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
  originToken,
  originAmount,
  needsAllowance,
  isCurve = false
}: {
  batchEnabled?: boolean;
  setBatchEnabled?: (enabled: boolean) => void;
  originToken: Token;
  originAmount: bigint;
  needsAllowance: boolean;
  isCurve?: boolean;
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
  const { flow, action } = widgetState;

  useEffect(() => {
    setOriginToken(originToken);
    setOriginAmount(originAmount);
  }, [originToken, originAmount]);

  // Sets the title and subtitle of the card
  useEffect(() => {
    if (flow === StUSDSFlow.SUPPLY) {
      setStepTwoTitle(isCurve ? t`Swap` : t`Supply`);
      setTxTitle(i18n._(stusdsSupplyReviewTitle));
      setTxSubtitle(
        i18n._(
          getStUSDSSupplyReviewSubtitle({
            batchStatus: !!batchSupported && batchEnabled ? BatchStatus.ENABLED : BatchStatus.DISABLED,
            symbol: originToken.symbol,
            needsAllowance,
            isCurve
          })
        )
      );
    } else if (flow === StUSDSFlow.WITHDRAW) {
      setStepTwoTitle(isCurve ? t`Swap` : t`Withdraw`);
      setTxTitle(i18n._(stusdsWithdrawReviewTitle));
      setTxSubtitle(
        i18n._(
          getStUSDSWithdrawReviewSubtitle({
            batchStatus: !!batchSupported && batchEnabled ? BatchStatus.ENABLED : BatchStatus.DISABLED,
            symbol: 'USDS',
            needsAllowance,
            isCurve
          })
        )
      );
    }
    setTxDescription(i18n._(stusdsActionDescription({ flow, action, txStatus, needsAllowance })));
  }, [
    flow,
    action,
    txStatus,
    i18n.locale,
    batchSupported,
    batchEnabled,
    needsAllowance,
    originToken,
    isCurve
  ]);

  return <TransactionReview batchEnabled={batchEnabled} setBatchEnabled={setBatchEnabled} />;
};
