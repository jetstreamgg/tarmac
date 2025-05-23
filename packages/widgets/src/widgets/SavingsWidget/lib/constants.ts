import { msg } from '@lingui/core/macro';
import { TxStatus } from '@widgets/shared/constants';
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
  TRANSACTION = 'transaction'
}

export const savingsApproveTitle: TxCardCopyText = {
  [TxStatus.INITIALIZED]: msg`Begin the savings process`,
  [TxStatus.LOADING]: msg`In progress`,
  [TxStatus.SUCCESS]: msg`Token access approved`,
  [TxStatus.ERROR]: msg`Error`
};

export const savingsSupplyTitle: TxCardCopyText = {
  [TxStatus.INITIALIZED]: msg`Confirm your transfer`,
  [TxStatus.LOADING]: msg`In progress`,
  [TxStatus.SUCCESS]: msg`Success!`,
  [TxStatus.ERROR]: msg`Error`
};

export const savingsWithdrawTitle: TxCardCopyText = {
  [TxStatus.INITIALIZED]: msg`Confirm your transfer`,
  [TxStatus.LOADING]: msg`In progress`,
  [TxStatus.SUCCESS]: msg`Success!`,
  [TxStatus.ERROR]: msg`Error`
};

export function getSavingsApproveSubtitle(txStatus: TxStatus, symbol: string): MessageDescriptor {
  switch (txStatus) {
    case TxStatus.INITIALIZED:
      return msg`Please allow this app to access the ${symbol} in your wallet.`;
    case TxStatus.LOADING:
      return msg`Token access approval in progress.`;
    case TxStatus.SUCCESS:
      return msg`Next, confirm the transaction in your wallet.`;
    case TxStatus.ERROR:
      return msg`An error occurred when allowing this app to access the ${symbol} in your wallet.`;
    default:
      return msg``;
  }
}

export function supplySubtitle({
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
      return msg`Almost done!`;
    case TxStatus.LOADING:
      return msg`Your supply is being processed on the blockchain. Please wait.`;
    case TxStatus.SUCCESS:
      return msg`You've supplied ${amount} ${symbol} to the Sky Savings Rate module`;
    case TxStatus.ERROR:
      return msg`An error occurred while supplying your ${symbol}.`;
    default:
      return msg``;
  }
}
export function withdrawSubtitle({
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
      return msg`Almost done!`;
    case TxStatus.LOADING:
      return msg`Your withdrawal is being processed on the blockchain. Please wait.`;
    case TxStatus.SUCCESS:
      return msg`You've withdrawn ${amount} ${symbol} from the Sky Savings Rate module.`;
    case TxStatus.ERROR:
      return msg`An error occurred while withdrawing your ${symbol}.`;
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
  txStatus
}: {
  flow: SavingsFlow;
  action: SavingsAction;
  txStatus: TxStatus;
}): MessageDescriptor {
  if ((action === SavingsAction.SUPPLY || action === SavingsAction.WITHDRAW) && txStatus === TxStatus.SUCCESS)
    return msg`${flow === SavingsFlow.SUPPLY ? 'Supplied to' : 'Withdrawn from'} the Sky Savings Rate module`;
  return msg`${
    flow === SavingsFlow.SUPPLY ? 'Supplying to' : 'Withdrawing from'
  } the Sky Savings Rate module`;
}
