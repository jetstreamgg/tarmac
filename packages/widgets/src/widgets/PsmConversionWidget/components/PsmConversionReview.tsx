import { t } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { useContext, useEffect } from 'react';
import { ZERO_ADDRESS, type TokenForChain, tokenForChainToToken } from '@jetstreamgg/sky-hooks';
import { TransactionReview } from '@widgets/shared/components/ui/transaction/TransactionReview';
import { WidgetContext } from '@widgets/context/WidgetContext';
import { useChainId } from 'wagmi';

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
  originToken: TokenForChain;
  originAmount: bigint;
  targetToken: TokenForChain;
  targetAmount: bigint;
  needsAllowance: boolean;
  legalBatchTxUrl?: string;
  isBatchFlowSupported?: boolean;
}) {
  const chainId = useChainId();
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
  const originTokenForContext = tokenForChainToToken(originToken, originToken.address || ZERO_ADDRESS, chainId);
  const targetTokenForContext = tokenForChainToToken(targetToken, targetToken.address || ZERO_ADDRESS, chainId);

  useEffect(() => {
    setOriginToken(originTokenForContext);
    setOriginAmount(originAmount);
    setTargetToken(targetTokenForContext);
    setTargetAmount(targetAmount);
    setStepTwoTitle(t`Convert`);
    setTxTitle(i18n._(t`Review conversion`));
    setTxSubtitle(
      i18n._(
        needsAllowance
          ? isBatchTransaction
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
    originTokenForContext,
    setOriginAmount,
    setOriginToken,
    setStepTwoTitle,
    setTargetAmount,
    setTargetToken,
    setTxDescription,
    setTxSubtitle,
    setTxTitle,
    targetAmount,
    targetToken,
    targetTokenForContext
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
