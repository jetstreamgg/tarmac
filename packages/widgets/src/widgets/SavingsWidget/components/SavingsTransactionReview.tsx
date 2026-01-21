import { Token, useIsBatchSupported } from '@jetstreamgg/sky-hooks';
import { isL2ChainId } from '@jetstreamgg/sky-utils';
import { t } from '@lingui/core/macro';
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
import { UpgradeAndSupplySteps } from './UpgradeAndSupplySteps';
import { BundledTransactionWarning } from '@widgets/shared/components/ui/BundledTransactionWarning';

export const SavingsTransactionReview = ({
  batchEnabled,
  setBatchEnabled,
  isBatchTransaction,
  originToken,
  originAmount,
  needsAllowance,
  isUpgradeSupplyFlow,
  shouldUseBatch,
  legalBatchTxUrl
}: {
  batchEnabled?: boolean;
  setBatchEnabled?: (enabled: boolean) => void;
  isBatchTransaction: boolean;
  originToken: Token;
  originAmount: bigint;
  needsAllowance: boolean;
  isUpgradeSupplyFlow?: boolean;
  shouldUseBatch?: boolean;
  legalBatchTxUrl?: string;
}) => {
  const { i18n } = useLingui();
  const { data: batchSupported } = useIsBatchSupported();
  const chainId = useChainId();
  const isL2Chain = isL2ChainId(chainId);
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
    if (flow === SavingsFlow.SUPPLY) {
      setStepTwoTitle(t`Supply`);
      setTxTitle(i18n._(savingsSupplyReviewTitle));
      setTxSubtitle(
        i18n._(
          getSavingsSupplyReviewSubtitle({
            batchStatus: !!batchSupported && batchEnabled ? BatchStatus.ENABLED : BatchStatus.DISABLED,
            symbol: originToken.symbol,
            needsAllowance
          })
        )
      );
    } else if (flow === SavingsFlow.WITHDRAW) {
      setStepTwoTitle(t`Withdraw`);
      setTxTitle(i18n._(savingsWithdrawReviewTitle));
      setTxSubtitle(
        i18n._(
          getSavingsWithdrawReviewSubtitle({
            batchStatus: !!batchSupported && batchEnabled ? BatchStatus.ENABLED : BatchStatus.DISABLED,
            symbol: isL2Chain ? 'sUSDS' : 'USDS',
            needsAllowance,
            isL2Chain
          })
        )
      );
    }
    setTxDescription(i18n._(savingsActionDescription({ flow, action, txStatus, needsAllowance, isL2Chain })));
  }, [flow, action, screen, i18n.locale, isBatchTransaction, batchSupported, batchEnabled]);

  return (
    <>
      <TransactionReview
        batchEnabled={batchEnabled}
        setBatchEnabled={setBatchEnabled}
        customSteps={isUpgradeSupplyFlow ? <UpgradeAndSupplySteps /> : undefined}
        legalBatchTxUrl={legalBatchTxUrl}
      />
      {isUpgradeSupplyFlow && !shouldUseBatch && (
        <BundledTransactionWarning flowTitle="Supplying DAI to the Sky Savings Rate" />
      )}
    </>
  );
};
