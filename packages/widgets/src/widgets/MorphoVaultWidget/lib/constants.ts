import { msg } from '@lingui/core/macro';
import { BatchStatus, TxStatus } from '@widgets/shared/constants';
import { TxCardCopyText } from '@widgets/shared/types/txCardCopyText';
import { MessageDescriptor } from '@lingui/core';

export enum MorphoVaultFlow {
  SUPPLY = 'supply',
  WITHDRAW = 'withdraw',
  CLAIM = 'claim'
}

export enum MorphoVaultAction {
  APPROVE = 'approve',
  SUPPLY = 'supply',
  WITHDRAW = 'withdraw',
  CLAIM = 'claim'
}

export enum MorphoVaultScreen {
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

export const morphoVaultClaimTitle: TxCardCopyText = {
  [TxStatus.INITIALIZED]: msg`Confirm your claim`,
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
  needsAllowance
}: {
  batchStatus: BatchStatus;
  symbol: string;
  needsAllowance: boolean;
}): MessageDescriptor {
  if (!needsAllowance) {
    return msg`You will supply your ${symbol} to the Morpho Vault.`;
  }

  switch (batchStatus) {
    case BatchStatus.ENABLED:
      return msg`You're allowing this app to access your ${symbol} and supply it to the Morpho Vault in one bundled transaction.`;
    case BatchStatus.DISABLED:
      return msg`You're allowing this app to access your ${symbol} and supply it to the Morpho Vault in multiple transactions.`;
    default:
      return msg``;
  }
}

export function getMorphoVaultWithdrawReviewSubtitle({ symbol }: { symbol: string }): MessageDescriptor {
  return msg`You will withdraw your ${symbol} from the Morpho Vault.`;
}

// Action descriptions
export function morphoVaultActionDescription({
  flow,
  action,
  txStatus,
  needsAllowance
}: {
  flow: MorphoVaultFlow;
  action: MorphoVaultAction;
  txStatus: TxStatus;
  needsAllowance: boolean;
}): MessageDescriptor {
  if (
    (action === MorphoVaultAction.SUPPLY || action === MorphoVaultAction.WITHDRAW) &&
    txStatus === TxStatus.SUCCESS
  ) {
    return msg`${flow === MorphoVaultFlow.SUPPLY ? 'Approved and supplied to' : 'Withdrawn from'} the Morpho Vault`;
  }
  return needsAllowance
    ? msg`${flow === MorphoVaultFlow.SUPPLY ? 'Approving and supplying to' : 'Withdrawing from'} the Morpho Vault`
    : msg`${flow === MorphoVaultFlow.SUPPLY ? 'Supplying to' : 'Withdrawing from'} the Morpho Vault`;
}

// Transaction status subtitles
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
        ? msg`Please allow this app to access your ${symbol} and supply it to the Morpho Vault.`
        : msg`Almost done!`;
    case TxStatus.LOADING:
      return needsAllowance
        ? msg`Your token approval and supply are being processed on the blockchain. Please wait.`
        : msg`Your supply is being processed on the blockchain. Please wait.`;
    case TxStatus.SUCCESS:
      return msg`You've supplied ${amount} ${symbol} to the Morpho Vault`;
    case TxStatus.ERROR:
      return msg`An error occurred during the supply flow.`;
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
      return msg`You've withdrawn ${amount} ${symbol} from the Morpho Vault.`;
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
  action?: MorphoVaultAction;
}): MessageDescriptor {
  switch (txStatus) {
    case TxStatus.INITIALIZED:
      return msg`Waiting for confirmation`;
    case TxStatus.LOADING:
      return action === MorphoVaultAction.APPROVE
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

// Claim rewards
export function claimSubtitle({
  txStatus,
  claimAmountText
}: {
  txStatus: TxStatus;
  claimAmountText: string;
}): MessageDescriptor {
  switch (txStatus) {
    case TxStatus.INITIALIZED:
      return msg`Please confirm that you want to claim your rewards directly to your wallet.`;
    case TxStatus.LOADING:
      return msg`Your claim is being processed on the blockchain. Please wait.`;
    case TxStatus.SUCCESS:
      return msg`You've claimed ${claimAmountText} rewards`;
    case TxStatus.ERROR:
      return msg`An error occurred while claiming your rewards.`;
    default:
      return msg``;
  }
}

export function claimLoadingButtonText({
  txStatus,
  claimAmountText
}: {
  txStatus: TxStatus;
  claimAmountText: string;
}): MessageDescriptor {
  switch (txStatus) {
    case TxStatus.INITIALIZED:
      return msg`Waiting for confirmation`;
    case TxStatus.LOADING:
      return msg`Claiming ${claimAmountText}`;
    default:
      return msg``;
  }
}

export function claimActionDescription({ txStatus }: { txStatus: TxStatus }): MessageDescriptor {
  switch (txStatus) {
    case TxStatus.SUCCESS:
      return msg`Claimed from the Morpho Vault rewards`;
    default:
      return msg`Claiming from the Morpho Vault rewards`;
  }
}
