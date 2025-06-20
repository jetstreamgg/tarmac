import { Token } from '@jetstreamgg/sky-hooks';
import { useLingui } from '@lingui/react/macro';
import { WidgetContext } from '@widgets/context/WidgetContext';
import { TransactionReview } from '@widgets/shared/components/ui/transaction/TransactionReview';
import { BatchStatus } from '@widgets/shared/constants';
import { getL2TradeReviewSubtitle, l2TradeDescription, l2TradeReviewTitle } from '../lib/constants';
import { TradeFlow } from '@widgets/widgets/TradeWidget/lib/constants';
import { useContext, useEffect } from 'react';

export const L2TradeTransactionReview = ({
  onExternalLinkClicked,
  batchEnabled,
  setBatchEnabled,
  isBatchTransaction,
  originToken,
  originAmount,
  targetToken,
  targetAmount,
  needsAllowance
}: {
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
  batchEnabled?: boolean;
  setBatchEnabled?: (enabled: boolean) => void;
  isBatchTransaction: boolean;
  originToken: Token;
  originAmount: bigint;
  targetToken: Token;
  targetAmount: bigint;
  needsAllowance: boolean;
}) => {
  const { i18n } = useLingui();
  const {
    setTxTitle,
    setTxSubtitle,
    setOriginToken,
    setOriginAmount,
    setTargetToken,
    setTargetAmount,
    setTxDescription,
    widgetState
  } = useContext(WidgetContext);
  const { flow, action, screen } = widgetState;

  useEffect(() => {
    setOriginToken(originToken);
    setOriginAmount(originAmount);
    setTargetToken(targetToken);
    setTargetAmount(targetAmount);
  }, [originToken, originAmount, targetToken, targetAmount]);

  // Sets the title and subtitle of the card
  useEffect(() => {
    if (flow === TradeFlow.TRADE) {
      setTxTitle(i18n._(l2TradeReviewTitle));
      setTxSubtitle(
        i18n._(
          getL2TradeReviewSubtitle({
            batchStatus: batchEnabled ? BatchStatus.ENABLED : BatchStatus.DISABLED,
            originToken,
            targetToken,
            needsAllowance
          })
        )
      );
    }
    setTxDescription(i18n._(l2TradeDescription({ originToken, targetToken })));
  }, [flow, action, screen, i18n.locale, isBatchTransaction, batchEnabled]);

  return (
    <TransactionReview
      onExternalLinkClicked={onExternalLinkClicked}
      batchEnabled={batchEnabled}
      setBatchEnabled={setBatchEnabled}
    />
  );
};
