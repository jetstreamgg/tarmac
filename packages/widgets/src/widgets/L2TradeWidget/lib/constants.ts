import { TxCardCopyTextWithCancel } from '@widgets/shared/types/txCardCopyText';
import { BatchStatus, TxStatus } from '@widgets/shared/constants';
import { msg } from '@lingui/core/macro';
import { MessageDescriptor } from '@lingui/core';
import { Token } from '@jetstreamgg/sky-hooks';

export const l2TradeReviewTitle = msg`Begin the trade process`;

export function getL2TradeReviewSubtitle({
  batchStatus,
  originToken,
  targetToken,
  needsAllowance
}: {
  batchStatus: BatchStatus;
  originToken: Token;
  targetToken: Token;
  needsAllowance: boolean;
}): MessageDescriptor {
  if (!needsAllowance) {
    return msg`You will trade your ${originToken.symbol} for ${targetToken.symbol}.`;
  }

  switch (batchStatus) {
    case BatchStatus.ENABLED:
      return msg`You're allowing this app to access the ${originToken.symbol} in your wallet and trade it for ${targetToken.symbol} in one bundled transaction.`;
    case BatchStatus.DISABLED:
      return msg`You're allowing this app to access the ${originToken.symbol} in your wallet and trade it for ${targetToken.symbol} in multiple transactions.`;
    default:
      return msg``;
  }
}

export const l2TradeTitle: TxCardCopyTextWithCancel = {
  [TxStatus.INITIALIZED]: msg`Begin the trade process`,
  [TxStatus.LOADING]: msg`In progress`,
  [TxStatus.SUCCESS]: msg`Trade completed`,
  [TxStatus.ERROR]: msg`Error`,
  [TxStatus.CANCELLED]: msg`Order cancelled`
};

export function l2TradeSubtitle({
  txStatus,
  originToken,
  originAmount,
  targetToken,
  targetAmount,
  needsAllowance
}: {
  txStatus: TxStatus;
  originToken: Token;
  originAmount: string;
  targetToken: Token;
  targetAmount: string;
  needsAllowance: boolean;
}): MessageDescriptor {
  switch (txStatus) {
    case TxStatus.INITIALIZED:
      return needsAllowance
        ? msg`Please allow this app to access the ${originToken.symbol} in your wallet and trade it for ${targetToken.symbol}.`
        : msg`Almost done!`;
    case TxStatus.LOADING:
      return needsAllowance
        ? msg`Your token approval and trade are being processed on the blockchain. Please wait.`
        : msg`Your trade is being processed on the blockchain. Please wait.`;
    case TxStatus.SUCCESS:
      return msg`You received ${targetAmount} ${targetToken.symbol} for ${originAmount} ${originToken.symbol}.`;
    case TxStatus.ERROR:
      return msg`An error occurred during the trade flow.`;
    default:
      return msg`Unknown status.`;
  }
}

export function l2TradeDescription({
  originToken,
  targetToken,
  executionPrice
}: {
  originToken: Token;
  targetToken: Token;
  executionPrice?: string;
}): MessageDescriptor {
  if (!executionPrice) return msg`Trading ${originToken.symbol} for ${targetToken.symbol}`;
  return msg`1 ${targetToken.symbol} = ${executionPrice} ${originToken.symbol}`;
}

export function l2TradeLoadingButtonText({ txStatus }: { txStatus: TxStatus }): MessageDescriptor {
  switch (txStatus) {
    case TxStatus.INITIALIZED:
      return msg`Waiting for confirmation`;
    case TxStatus.LOADING:
      return msg`Trading`;
    default:
      return msg``;
  }
}
