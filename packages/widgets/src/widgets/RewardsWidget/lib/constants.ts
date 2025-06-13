import { msg } from '@lingui/core/macro';
import { TxStatus } from '@widgets/shared/constants';
import { TxCardCopyText } from '@widgets/shared/types/txCardCopyText';
import { MessageDescriptor } from '@lingui/core';
import { RewardContract } from '@jetstreamgg/sky-hooks';

export enum RewardsFlow {
  SUPPLY = 'supply',
  WITHDRAW = 'withdraw',
  CLAIM = 'claim'
}

export enum RewardsAction {
  OVERVIEW = 'overview',
  APPROVE = 'approve',
  SUPPLY = 'supply',
  WITHDRAW = 'withdraw',
  CLAIM = 'claim'
}

export enum RewardsScreen {
  ACTION = 'action',
  TRANSACTION = 'transaction'
}

export const rewardsApproveTitle: TxCardCopyText = {
  [TxStatus.INITIALIZED]: msg`Approve tokens access`,
  [TxStatus.LOADING]: msg`In progress`,
  [TxStatus.SUCCESS]: msg`Token access approved`,
  [TxStatus.ERROR]: msg`Error`
};

export function rewardsApproveSubtitle(txStatus: TxStatus, symbol: string): string {
  switch (txStatus) {
    case TxStatus.INITIALIZED:
      return `Please allow this app access to the ${symbol} in your wallet.`;
    case TxStatus.LOADING:
      return 'Token access approval in progress';
    case TxStatus.SUCCESS:
      return 'Next, confirm this transaction in your wallet.';
    case TxStatus.ERROR:
      return 'An error occurred when giving permissions to access the tokens in your wallet';
    default:
      return '';
  }
}

export const rewardsSupplyTitle: TxCardCopyText = {
  [TxStatus.INITIALIZED]: msg`Confirm your transfer`,
  [TxStatus.LOADING]: msg`In progress`,
  [TxStatus.SUCCESS]: msg`Success!`,
  [TxStatus.ERROR]: msg`Error`
};

export const rewardsWithdrawTitle: TxCardCopyText = {
  [TxStatus.INITIALIZED]: msg`Confirm your transfer`,
  [TxStatus.LOADING]: msg`In progress`,
  [TxStatus.SUCCESS]: msg`Successfully withdrawn`,
  [TxStatus.ERROR]: msg`Error`
};

export const rewardsClaimTitle: TxCardCopyText = {
  [TxStatus.INITIALIZED]: msg`Confirm your claim`,
  [TxStatus.LOADING]: msg`In progress`,
  [TxStatus.SUCCESS]: msg`Success!`,
  [TxStatus.ERROR]: msg`Error`
};

export function rewardsSupplyLoadingButtonText({
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

export function rewardsSupplySubtitle({
  txStatus,
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
      return msg`Your transfer is being processed on the blockchain. Please wait.`;
    case TxStatus.SUCCESS:
      return msg`You’ve added ${symbol} to the Sky Token Rewards module.`;
    case TxStatus.ERROR:
      return msg`An error occurred while supplying ${symbol}`;
    default:
      return msg``;
  }
}

export function rewardsWithdrawLoadingButtonText({
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

export function rewardsWithdrawSubtitle({
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
      return msg`Preparing to withdraw ${amount} ${symbol}`;
    case TxStatus.LOADING:
      return msg`Withdrawing ${amount} ${symbol}`;
    case TxStatus.SUCCESS:
      return msg`You successfully withdrew ${amount} ${symbol}`;
    case TxStatus.ERROR:
      return msg`An error occurred while withdrawing ${symbol}`;
    default:
      return msg``;
  }
}

export function rewardsActionDescription({
  flow,
  txStatus,
  selectedRewardContract
}: {
  flow: RewardsFlow;
  txStatus: TxStatus;
  selectedRewardContract: RewardContract;
}): MessageDescriptor {
  switch (flow) {
    case RewardsFlow.SUPPLY:
      if (txStatus === TxStatus.SUCCESS) {
        return msg`Supplied ${selectedRewardContract.supplyToken.symbol} to Sky Token Rewards module`;
      } else {
        return msg`Supplying ${selectedRewardContract.supplyToken.symbol} to Sky Token Rewards module`;
      }
    case RewardsFlow.WITHDRAW:
      return msg`Withdrawing ${selectedRewardContract.supplyToken.symbol} from Sky Token Rewards module`;
    default:
      return msg``;
  }
}

export function rewardsClaimLoadingButtonText({
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
      return msg`Claiming ${amount} ${symbol}`;
    default:
      return msg``;
  }
}

export function rewardsClaimSubtitle({
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
      return msg`Please confirm that you want to claim your ${symbol} rewards directly to your wallet.`;
    case TxStatus.LOADING:
      return msg`Your claim is being processed on the blockchain. Please wait.`;
    case TxStatus.SUCCESS:
      return msg`You’ve claimed ${amount} ${symbol} rewards`;
    case TxStatus.ERROR:
      return msg`An error occurred while claiming your ${amount} ${symbol}`;
    default:
      return msg``;
  }
}

export function rewardsClaimTxDescription({
  txStatus,
  selectedRewardContract
}: {
  txStatus: TxStatus;
  selectedRewardContract: RewardContract;
}): MessageDescriptor {
  switch (txStatus) {
    case TxStatus.INITIALIZED:
    case TxStatus.LOADING:
      return msg`Claiming from the ${selectedRewardContract.name} rewards pool`;
    case TxStatus.SUCCESS:
      return msg`Claimed from the ${selectedRewardContract.name} rewards pool`;
    case TxStatus.ERROR:
      return msg`Error claiming from the ${selectedRewardContract.name} rewards pool`;
    default:
      return msg``;
  }
}
