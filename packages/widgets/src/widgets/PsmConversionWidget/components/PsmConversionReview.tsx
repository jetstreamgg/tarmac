import { t } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { useContext, useEffect } from 'react';
import { Token } from '@jetstreamgg/sky-hooks';
import { BatchStatus } from '@widgets/shared/constants';
import { TransactionReview } from '@widgets/shared/components/ui/transaction/TransactionReview';
import { WidgetContext } from '@widgets/context/WidgetContext';

export function PsmConversionReview({
  batchEnabled,
  setBatchEnabled,
  isBatchTransaction,
  originToken,
  originAmount,
  targetToken,
  targetAmount,
  needsAllowance,
  legalBatchTxUrl,
  isBatchFlowSupported
}: {
  batchEnabled?: boolean;
  setBatchEnabled?: (enabled: boolean) => void;
  isBatchTransaction: boolean;
  originToken: Token;
  originAmount: bigint;
  targetToken: Token;
  targetAmount: bigint;
  needsAllowance: boolean;
  legalBatchTxUrl?: string;
  isBatchFlowSupported?: boolean;
}) {
  const { i18n } = useLingui();
  const {
    setTxTitle,
    setTxSubtitle,
    setStepTwoTitle,
    setOriginToken,
    setOriginAmount,
    setTargetToken,
    setTargetAmount,
    setTxDescription
  } = useContext(WidgetContext);

  useEffect(() => {
    setOriginToken(originToken);
    setOriginAmount(originAmount);
    setTargetToken(targetToken);
    setTargetAmount(targetAmount);
    setStepTwoTitle(t`Convert`);
    setTxTitle(i18n._(t`Review conversion`));
    setTxSubtitle(
      i18n._(
        needsAllowance
          ? batchEnabled
            ? t`Approve and convert ${originToken.symbol} to ${targetToken.symbol} in one bundled transaction.`
            : t`Approve ${originToken.symbol} first, then complete the conversion to ${targetToken.symbol}.`
          : t`Convert ${originToken.symbol} to ${targetToken.symbol} at a 1:1 rate.`
      )
    );
    setTxDescription(
      i18n._(
        isBatchTransaction || !needsAllowance
          ? t`You are converting through the Peg Stability Module at a fixed 1:1 rate.`
          : t`This flow requires an approval transaction before the conversion transaction.`
      )
    );
  }, [
    batchEnabled,
    i18n,
    isBatchTransaction,
    needsAllowance,
    originAmount,
    originToken,
    setOriginAmount,
    setOriginToken,
    setStepTwoTitle,
    setTargetAmount,
    setTargetToken,
    setTxDescription,
    setTxSubtitle,
    setTxTitle,
    targetAmount,
    targetToken
  ]);

  return (
    <TransactionReview
      batchEnabled={batchEnabled}
      setBatchEnabled={setBatchEnabled}
      legalBatchTxUrl={legalBatchTxUrl}
      isBatchFlowSupported={isBatchFlowSupported}
    />
  );
}
