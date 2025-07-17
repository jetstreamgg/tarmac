import { msg } from '@lingui/core/macro';
import { BatchStatus, TxStatus } from '@widgets/shared/constants';
import { TxCardCopyText } from '@widgets/shared/types/txCardCopyText';
import { MessageDescriptor } from '@lingui/core';

export enum SavingsFlow {
  SUPPLY = 'supply',
  WITHDRAW = 'withdraw'
}

export enum SavingsAction {
  APPROVE = 'approve',
  SUPPLY = 'supply',
  WITHDRAW = 'withdraw'
}

export enum SavingsScreen {
  ACTION = 'action',
  REVIEW = 'review',
  TRANSACTION = 'transaction'
}

export const savingsSupplyTitle: TxCardCopyText = {
  [TxStatus.INITIALIZED]: msg`Begin the supply process`,
  [TxStatus.LOADING]: msg`In progress`,
  [TxStatus.SUCCESS]: msg`Success!`,
  [TxStatus.ERROR]: msg`Error`
};

export const savingsWithdrawTitle: TxCardCopyText = {
  [TxStatus.INITIALIZED]: msg`Begin the withdraw process`,
  [TxStatus.LOADING]: msg`In progress`,
  [TxStatus.SUCCESS]: msg`Success!`,
  [TxStatus.ERROR]: msg`Error`
};

export const savingsSupplyReviewTitle = msg`Begin the supply process`;
export const savingsWithdrawReviewTitle = msg`Begin the withdraw process`;
export function getSavingsSupplyReviewSubtitle({
  batchStatus,
  symbol,
  needsAllowance
}: {
  batchStatus: BatchStatus;
  symbol: string;
  needsAllowance: boolean;
}): MessageDescriptor {
  if (!needsAllowance) {
    return msg`You will supply your ${symbol} to the Sky Savings Rate module.`;
  }

  switch (batchStatus) {
    case BatchStatus.ENABLED:
      return msg`You're allowing this app to access your ${symbol} and supply it to the Sky Savings Rate module in one bundled transaction.`;
    case BatchStatus.DISABLED:
      return msg`You're allowing this app to access your ${symbol} and supply it to the Sky Savings Rate module in multiple transactions.`;
    default:
      return msg``;
  }
}
export function getSavingsWithdrawReviewSubtitle({
  batchStatus,
  symbol,
  needsAllowance,
  isL2Chain
}: {
  batchStatus: BatchStatus;
  symbol: string;
  needsAllowance: boolean;
  isL2Chain: boolean;
}): MessageDescriptor {
  if (!isL2Chain || !needsAllowance) {
    return msg`You will withdraw your ${symbol} from the Sky Savings Rate module.`;
  }

  switch (batchStatus) {
    case BatchStatus.ENABLED:
      return msg`You're allowing this app to access your ${symbol} and withdraw from the Sky Savings Rate module in one bundled transaction.`;
    case BatchStatus.DISABLED:
      return msg`You're allowing this app to access your ${symbol} and withdraw from the Sky Savings Rate module in multiple transactions.`;
    default:
      return msg``;
  }
}

export function supplySubtitle({
  txStatus,
  amount,
  symbol,
  needsAllowance
}: {
  txStatus: TxStatus;
  amount: string;
  symbol: string;
  needsAllowance: boolean;
}): MessageDescriptor {
  switch (txStatus) {
    case TxStatus.INITIALIZED:
      return needsAllowance
        ? msg`Please allow this app to access your ${symbol} and supply it to the Sky Savings Rate module.`
        : msg`Almost done!`;
    case TxStatus.LOADING:
      return needsAllowance
        ? msg`Your token approval and supply are being processed on the blockchain. Please wait.`
        : msg`Your supply is being processed on the blockchain. Please wait.`;
    case TxStatus.SUCCESS:
      return msg`You've supplied ${amount} ${symbol} to the Sky Savings Rate module`;
    case TxStatus.ERROR:
      return msg`An error occurred during the supply flow.`;
    default:
      return msg``;
  }
}
export function withdrawSubtitle({
  txStatus,
  amount,
  symbol,
  needsAllowance,
  isL2Chain
}: {
  txStatus: TxStatus;
  amount: string;
  symbol: string;
  needsAllowance: boolean;
  isL2Chain: boolean;
}): MessageDescriptor {
  switch (txStatus) {
    case TxStatus.INITIALIZED:
      return isL2Chain && needsAllowance
        ? msg`Please allow this app to access your ${symbol} and withdraw it from the Sky Savings Rate module.`
        : msg`Almost done!`;
    case TxStatus.LOADING:
      return isL2Chain && needsAllowance
        ? msg`Your token approval and withdrawal are being processed on the blockchain. Please wait.`
        : msg`Your withdrawal is being processed on the blockchain. Please wait.`;
    case TxStatus.SUCCESS:
      return msg`You've withdrawn ${amount} ${symbol} from the Sky Savings Rate module.`;
    case TxStatus.ERROR:
      return msg`An error occurred during the withdraw flow.`;
    default:
      return msg``;
  }
}

export function supplyLoadingButtonText({
  txStatus,
  amount,
  symbol
}: {
  txStatus: TxStatus;
  amount: string;
  symbol: string;
}): MessageDescriptor {
  switch (txStatus) {
    case TxStatus.INITIALIZED:
      return msg`Waiting for confirmation`;
    case TxStatus.LOADING:
      return msg`Transferring ${amount} ${symbol}`;
    default:
      return msg``;
  }
}

export function withdrawLoadingButtonText({
  txStatus,
  amount,
  symbol
}: {
  txStatus: TxStatus;
  amount: string;
  symbol: string;
}): MessageDescriptor {
  switch (txStatus) {
    case TxStatus.INITIALIZED:
      return msg`Waiting for confirmation`;
    case TxStatus.LOADING:
      return msg`Withdrawing ${amount} ${symbol}`;
    default:
      return msg``;
  }
}

export function savingsActionDescription({
  flow,
  action,
  txStatus,
  needsAllowance,
  isL2Chain
}: {
  flow: SavingsFlow;
  action: SavingsAction;
  txStatus: TxStatus;
  needsAllowance: boolean;
  isL2Chain: boolean;
}): MessageDescriptor {
  if ((action === SavingsAction.SUPPLY || action === SavingsAction.WITHDRAW) && txStatus === TxStatus.SUCCESS)
    return msg`${flow === SavingsFlow.SUPPLY ? 'Approved and supplied to' : isL2Chain ? 'Approved and withdrawn from' : 'Withdrawn from'} the Sky Savings Rate module`;
  return needsAllowance
    ? msg`${
        flow === SavingsFlow.SUPPLY
          ? 'Approving and supplying to'
          : isL2Chain
            ? 'Approving and withdrawing from'
            : 'Withdrawing from'
      } the Sky Savings Rate module`
    : msg`${flow === SavingsFlow.SUPPLY ? 'Supplying to' : 'Withdrawing from'} the Sky Savings Rate module`;
}
