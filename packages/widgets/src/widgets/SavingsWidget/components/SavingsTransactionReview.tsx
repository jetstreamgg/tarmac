import { Token } from '@jetstreamgg/sky-hooks';
import { isL2ChainId } from '@jetstreamgg/sky-utils';
import { useLingui } from '@lingui/react/macro';
import { WidgetContext } from '@widgets/context/WidgetContext';
import { TransactionReview } from '@widgets/shared/components/ui/transaction/TransactionReview';
import { BatchStatus } from '@widgets/shared/constants';
import {
  getSavingsSupplyReviewSubtitle,
  getSavingsWithdrawReviewSubtitle,
  savingsActionDescription,
  SavingsFlow,
  savingsSupplyReviewTitle,
  savingsWithdrawReviewTitle
} from '@widgets/widgets/SavingsWidget/lib/constants';
import { useContext, useEffect } from 'react';
import { useChainId } from 'wagmi';

export const SavingsTransactionReview = ({
  onExternalLinkClicked,
  batchEnabled,
  setBatchEnabled,
  isBatchTransaction,
  originToken,
  originAmount,
  needsAllowance
}: {
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
  batchEnabled?: boolean;
  setBatchEnabled?: (enabled: boolean) => void;
  isBatchTransaction: boolean;
  originToken: Token;
  originAmount: bigint;
  needsAllowance: boolean;
}) => {
  const { i18n } = useLingui();
  const chainId = useChainId();
  const isL2Chain = isL2ChainId(chainId);
  const {
    setTxTitle,
    setTxSubtitle,
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
    if (flow === SavingsFlow.SUPPLY) {
      setTxTitle(i18n._(savingsSupplyReviewTitle));
      setTxSubtitle(
        i18n._(
          getSavingsSupplyReviewSubtitle({
            batchStatus: batchEnabled ? BatchStatus.ENABLED : BatchStatus.DISABLED,
            symbol: originToken.symbol,
            needsAllowance
          })
        )
      );
    } else if (flow === SavingsFlow.WITHDRAW) {
      setTxTitle(i18n._(savingsWithdrawReviewTitle));
      setTxSubtitle(
        i18n._(
          getSavingsWithdrawReviewSubtitle({
            batchStatus: batchEnabled ? BatchStatus.ENABLED : BatchStatus.DISABLED,
            symbol: isL2Chain ? 'sUSDS' : 'USDS',
            needsAllowance,
            isL2Chain
          })
        )
      );
    }
    setTxDescription(i18n._(savingsActionDescription({ flow, action, txStatus, needsAllowance, isL2Chain })));
  }, [flow, action, screen, i18n.locale, isBatchTransaction]);

  return (
    <TransactionReview
      onExternalLinkClicked={onExternalLinkClicked}
      batchEnabled={batchEnabled}
      setBatchEnabled={setBatchEnabled}
    />
  );
};
