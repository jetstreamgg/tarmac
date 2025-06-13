import { msg } from '@lingui/core/macro';
import { TxStatus } from '@widgets/shared/constants';
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
  TRANSACTION = 'transaction'
}

export const upgradeTokens = {
  DAI: TOKENS.usds.symbol,
  MKR: TOKENS.sky.symbol,
  USDS: TOKENS.dai.symbol,
  SKY: TOKENS.mkr.symbol
};

export function upgradeApproveTitle(txStatus: TxStatus, flow: UpgradeFlow): string {
  switch (txStatus) {
    case TxStatus.INITIALIZED:
      return flow === UpgradeFlow.UPGRADE ? 'Begin the upgrade process' : 'Begin the revert process';
    case TxStatus.LOADING:
      return 'In progress';
    case TxStatus.SUCCESS:
      return 'Token access approved';
    case TxStatus.ERROR:
      return 'Error';
    default:
      return '';
  }
}

export const upgradeTitle: TxCardCopyText = {
  [TxStatus.INITIALIZED]: msg`Confirm your upgrade`,
  [TxStatus.LOADING]: msg`In progress`,
  [TxStatus.SUCCESS]: msg`Success!`,
  [TxStatus.ERROR]: msg`Error`
};

export const revertTitle: TxCardCopyText = {
  [TxStatus.INITIALIZED]: msg`Confirm your revert`,
  [TxStatus.LOADING]: msg`In progress`,
  [TxStatus.SUCCESS]: msg`Success!`,
  [TxStatus.ERROR]: msg`Error`
};

export function approveUpgradeSubtitle(txStatus: TxStatus, symbol: string): MessageDescriptor {
  switch (txStatus) {
    case TxStatus.INITIALIZED:
      return msg`Please allow this app to access the ${symbol} in your wallet.`;
    case TxStatus.LOADING:
      return msg`Token access approval in progress.`;
    case TxStatus.SUCCESS:
      return msg`Next, confirm the upgrade transaction.`;
    case TxStatus.ERROR:
      return msg`An error occurred while approving access to your ${symbol}.`;
    default:
      return msg``;
  }
}

export function approveRevertSubtitle(txStatus: TxStatus, symbol: string): MessageDescriptor {
  switch (txStatus) {
    case TxStatus.INITIALIZED:
      return msg`Please allow this app to access the ${symbol} in your wallet.`;
    case TxStatus.LOADING:
      return msg`Token access approval in progress.`;
    case TxStatus.SUCCESS:
      return msg`Next, confirm the revert transaction.`;
    case TxStatus.ERROR:
      return msg`An error occurred while approving access to your ${symbol}.`;
    default:
      return msg``;
  }
}

export function upgradeActionDescription({
  flow,
  action,
  txStatus,
  originToken,
  targetToken
}: {
  flow: UpgradeFlow;
  action: UpgradeAction;
  txStatus: TxStatus;
  originToken: Token;
  targetToken: Token;
}): MessageDescriptor {
  if ((action === UpgradeAction.UPGRADE || action === UpgradeAction.REVERT) && txStatus === TxStatus.SUCCESS)
    return msg`${flow === UpgradeFlow.UPGRADE ? 'Upgraded' : 'Reverted'} ${originToken.symbol} to ${
      targetToken.symbol
    }`;
  return msg`${flow === UpgradeFlow.UPGRADE ? 'Upgrading' : 'Reverting'} ${originToken.symbol} to ${
    targetToken.symbol
  }`;
}

export function upgradeSubtitle({
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
      return msg`Your upgrade is being processed on the blockchain. Please wait.`;
    case TxStatus.SUCCESS:
      return msg`You've received ${amount} ${symbol}.`;
    case TxStatus.ERROR:
      return msg`An error occurred while upgrading your tokens.`;
    default:
      return msg``;
  }
}
export function revertSubtitle({
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
      return msg`Your revert is being processed on the blockchain. Please wait.`;
    case TxStatus.SUCCESS:
      return msg`You've received ${amount} ${symbol}.`;
    case TxStatus.ERROR:
      return msg`An error occurred while reverting your tokens.`;
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
