import { msg } from '@lingui/core/macro';
import { BatchStatus, TxStatus } from '@widgets/shared/constants';
import { TxCardCopyText } from '@widgets/shared/types/txCardCopyText';
import { TOKENS, Token } from '@jetstreamgg/sky-hooks';
import { MessageDescriptor } from '@lingui/core';

export enum UpgradeFlow {
  UPGRADE = 'upgrade',
  REVERT = 'revert'
}

export enum UpgradeAction {
  APPROVE = 'approve',
  UPGRADE = 'upgrade',
  REVERT = 'revert'
}

export enum UpgradeScreen {
  ACTION = 'action',
  REVIEW = 'review',
  TRANSACTION = 'transaction'
}

export const upgradeTokens = {
  DAI: TOKENS.usds.symbol,
  MKR: TOKENS.sky.symbol,
  USDS: TOKENS.dai.symbol,
  SKY: TOKENS.mkr.symbol
};

export const upgradeTitle: TxCardCopyText = {
  [TxStatus.INITIALIZED]: msg`Begin the upgrade process`,
  [TxStatus.LOADING]: msg`In progress`,
  [TxStatus.SUCCESS]: msg`Success!`,
  [TxStatus.ERROR]: msg`Error`
};

export const revertTitle: TxCardCopyText = {
  [TxStatus.INITIALIZED]: msg`Begin the revert process`,
  [TxStatus.LOADING]: msg`In progress`,
  [TxStatus.SUCCESS]: msg`Success!`,
  [TxStatus.ERROR]: msg`Error`
};

export const upgradeReviewTitle = msg`Begin the upgrade process`;

export const revertReviewTitle = msg`Begin the revert process`;

export function getUpgradeReviewSubtitle({
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
    return msg`You will upgrade your ${originToken.symbol} to ${targetToken.symbol}.`;
  }

  switch (batchStatus) {
    case BatchStatus.ENABLED:
      return msg`You're allowing this app to access your ${originToken.symbol} and upgrade it to ${targetToken.symbol} in one bundled transaction.`;
    case BatchStatus.DISABLED:
      return msg`You're allowing this app to access your ${originToken.symbol} and upgrade it to ${targetToken.symbol} in multiple transactions.`;
    default:
      return msg``;
  }
}
export function getRevertReviewSubtitle({
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
    return msg`You will revert your ${originToken.symbol} to ${targetToken.symbol}.`;
  }

  switch (batchStatus) {
    case BatchStatus.ENABLED:
      return msg`You're allowing this app to access your ${originToken.symbol} and revert it to ${targetToken.symbol} in one bundled transaction.`;
    case BatchStatus.DISABLED:
      return msg`You're allowing this app to access your ${originToken.symbol} and revert it to ${targetToken.symbol} in multiple transactions.`;
    default:
      return msg``;
  }
}

export function upgradeActionDescription({
  flow,
  action,
  txStatus,
  originToken,
  targetToken,
  needsAllowance
}: {
  flow: UpgradeFlow;
  action: UpgradeAction;
  txStatus: TxStatus;
  originToken: Token;
  targetToken: Token;
  needsAllowance: boolean;
}): MessageDescriptor {
  if ((action === UpgradeAction.UPGRADE || action === UpgradeAction.REVERT) && txStatus === TxStatus.SUCCESS)
    return msg`${flow === UpgradeFlow.UPGRADE ? 'Upgraded' : 'Reverted'} ${originToken.symbol} to ${
      targetToken.symbol
    }`;
  return msg`${flow === UpgradeFlow.UPGRADE ? (needsAllowance ? 'Approving and upgrading' : 'Upgrading') : needsAllowance ? 'Approving and reverting' : 'Reverting'} ${originToken.symbol} to ${
    targetToken.symbol
  }`;
}

export function upgradeSubtitle({
  txStatus,
  amount,
  originToken,
  targetToken,
  needsAllowance
}: {
  txStatus: TxStatus;
  amount: string;
  originToken: Token;
  targetToken: Token;
  needsAllowance: boolean;
}): MessageDescriptor {
  switch (txStatus) {
    case TxStatus.INITIALIZED:
      return needsAllowance
        ? msg`Please allow this app to access your ${originToken.symbol} and upgrade it to ${targetToken.symbol}.`
        : msg`Almost done!`;
    case TxStatus.LOADING:
      return needsAllowance
        ? msg`Your token approval and upgrade are being processed on the blockchain. Please wait.`
        : msg`Your upgrade is being processed on the blockchain. Please wait.`;
    case TxStatus.SUCCESS:
      return msg`You've received ${amount} ${targetToken.symbol}.`;
    case TxStatus.ERROR:
      return msg`An error occurred during the upgrade flow.`;
    default:
      return msg``;
  }
}
export function revertSubtitle({
  txStatus,
  amount,
  originToken,
  targetToken,
  needsAllowance
}: {
  txStatus: TxStatus;
  amount: string;
  originToken: Token;
  targetToken: Token;
  needsAllowance: boolean;
}): MessageDescriptor {
  switch (txStatus) {
    case TxStatus.INITIALIZED:
      return needsAllowance
        ? msg`Please allow this app to access your ${originToken.symbol} and revert it to ${targetToken.symbol}.`
        : msg`Almost done!`;
    case TxStatus.LOADING:
      return needsAllowance
        ? msg`Your token approval and revert are being processed on the blockchain. Please wait.`
        : msg`Your revert is being processed on the blockchain. Please wait.`;
    case TxStatus.SUCCESS:
      return msg`You've received ${amount} ${targetToken.symbol}.`;
    case TxStatus.ERROR:
      return msg`An error occurred during the revert flow.`;
    default:
      return msg``;
  }
}

export function upgradeRevertLoadingButtonText({
  txStatus,
  amount,
  symbol,
  actionLabel
}: {
  txStatus: TxStatus;
  amount: string;
  symbol: string;
  actionLabel: string;
}): MessageDescriptor {
  switch (txStatus) {
    case TxStatus.INITIALIZED:
      return msg`Waiting for confirmation`;
    case TxStatus.LOADING:
      return msg`${actionLabel} ${amount} ${symbol}`;
    default:
      return msg`Loading`;
  }
}

export const defaultUpgradeOptions = [TOKENS.dai, TOKENS.mkr];
export const defaultRevertOptions = [TOKENS.usds];
