import { msg } from '@lingui/core/macro';
import { BatchStatus, TxStatus } from '@/widgets/shared/constants';
import { TxCardCopyText } from '@/widgets/shared/types/txCardCopyText';
import { MessageDescriptor } from '@lingui/core';

export enum VaultFlow {
  SUPPLY = 'supply',
  WITHDRAW = 'withdraw',
  CLAIM = 'claim'
}

export enum VaultAction {
  APPROVE = 'approve',
  SUPPLY = 'supply',
  WITHDRAW = 'withdraw',
  CLAIM = 'claim'
}

export enum VaultScreen {
  ACTION = 'action',
  REVIEW = 'review',
  TRANSACTION = 'transaction'
}

// Transaction status titles
export const morphoVaultSupplyTitle: TxCardCopyText = {
  [TxStatus.INITIALIZED]: msg`Begin the supply process`,
  [TxStatus.LOADING]: msg`In progress`,
  [TxStatus.SUCCESS]: msg`Success!`,
  [TxStatus.ERROR]: msg`Error`
};

export const morphoVaultWithdrawTitle: TxCardCopyText = {
  [TxStatus.INITIALIZED]: msg`Begin the withdraw process`,
  [TxStatus.LOADING]: msg`In progress`,
  [TxStatus.SUCCESS]: msg`Success!`,
  [TxStatus.ERROR]: msg`Error`
};

// Review screen titles
export const morphoVaultSupplyReviewTitle = msg`Begin the supply process`;
export const morphoVaultWithdrawReviewTitle = msg`Begin the withdraw process`;

// Review screen subtitles
export function getMorphoVaultSupplyReviewSubtitle({
  batchStatus,
  symbol,
  needsAllowance,
  vaultLabel
}: {
  batchStatus: BatchStatus;
  symbol: string;
  needsAllowance: boolean;
  vaultLabel: string;
}): MessageDescriptor {
  if (!needsAllowance) {
    return msg`You will supply your ${symbol} to ${vaultLabel}.`;
  }

  switch (batchStatus) {
    case BatchStatus.ENABLED:
      return msg`You're allowing this app to access your ${symbol} and supply it to ${vaultLabel} in one bundled transaction.`;
    case BatchStatus.DISABLED:
      return msg`You're allowing this app to access your ${symbol} and supply it to ${vaultLabel} in multiple transactions.`;
    default:
      return msg``;
  }
}

export function getMorphoVaultWithdrawReviewSubtitle({
  symbol,
  vaultLabel
}: {
  symbol: string;
  vaultLabel: string;
}): MessageDescriptor {
  return msg`You will withdraw your ${symbol} from ${vaultLabel}.`;
}

// Action descriptions
export function morphoVaultActionDescription({
  flow,
  action,
  txStatus,
  needsAllowance,
  vaultLabel
}: {
  flow: VaultFlow;
  action: VaultAction;
  txStatus: TxStatus;
  needsAllowance: boolean;
  vaultLabel: string;
}): MessageDescriptor {
  if ((action === VaultAction.SUPPLY || action === VaultAction.WITHDRAW) && txStatus === TxStatus.SUCCESS) {
    return msg`${flow === VaultFlow.SUPPLY ? 'Approved and supplied to' : 'Withdrawn from'} ${vaultLabel}`;
  }
  return needsAllowance
    ? msg`${flow === VaultFlow.SUPPLY ? 'Approving and supplying to' : 'Withdrawing from'} ${vaultLabel}`
    : msg`${flow === VaultFlow.SUPPLY ? 'Supplying to' : 'Withdrawing from'} ${vaultLabel}`;
}

// Transaction status subtitles
export function supplySubtitle({
  txStatus,
  amount,
  symbol,
  needsAllowance,
  vaultLabel
}: {
  txStatus: TxStatus;
  amount: string;
  symbol: string;
  needsAllowance: boolean;
  vaultLabel: string;
}): MessageDescriptor {
  switch (txStatus) {
    case TxStatus.INITIALIZED:
      return needsAllowance
        ? msg`Please allow this app to access your ${symbol} and supply it to ${vaultLabel}.`
        : msg`Almost done!`;
    case TxStatus.LOADING:
      return needsAllowance
        ? msg`Your token approval and supply are being processed on the blockchain. Please wait.`
        : msg`Your supply is being processed on the blockchain. Please wait.`;
    case TxStatus.SUCCESS:
      return msg`You've supplied ${amount} ${symbol} to ${vaultLabel}`;
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
  vaultLabel
}: {
  txStatus: TxStatus;
  amount: string;
  symbol: string;
  vaultLabel: string;
}): MessageDescriptor {
  switch (txStatus) {
    case TxStatus.INITIALIZED:
      return msg`Almost done!`;
    case TxStatus.LOADING:
      return msg`Your withdrawal is being processed on the blockchain. Please wait.`;
    case TxStatus.SUCCESS:
      return msg`You've withdrawn ${amount} ${symbol} from ${vaultLabel}.`;
    case TxStatus.ERROR:
      return msg`An error occurred during the withdraw flow.`;
    default:
      return msg``;
  }
}

// Loading button text
export function supplyLoadingButtonText({
  txStatus,
  amount,
  symbol,
  action
}: {
  txStatus: TxStatus;
  amount: string;
  symbol: string;
  action?: VaultAction;
}): MessageDescriptor {
  switch (txStatus) {
    case TxStatus.INITIALIZED:
      return msg`Waiting for confirmation`;
    case TxStatus.LOADING:
      return action === VaultAction.APPROVE
        ? msg`Approving ${amount} ${symbol}`
        : msg`Transferring ${amount} ${symbol}`;
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
