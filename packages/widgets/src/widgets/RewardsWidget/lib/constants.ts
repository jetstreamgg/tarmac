import { msg } from '@lingui/core/macro';
import { BatchStatus, TxStatus } from '@widgets/shared/constants';
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
  REVIEW = 'review',
  TRANSACTION = 'transaction'
}

export const rewardsSupplyTitle: TxCardCopyText = {
  [TxStatus.INITIALIZED]: msg`Begin the supply process`,
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

export const rewardsSupplyReviewTitle = msg`Begin the supply process`;

export const rewardsWithdrawReviewTitle = msg`Begin the withdraw process`;

export function getRewardsSupplyReviewSubtitle({
  batchStatus,
  symbol,
  needsAllowance
}: {
  batchStatus: BatchStatus;
  symbol: string;
  needsAllowance: boolean;
}): MessageDescriptor {
  if (!needsAllowance) {
    return msg`You will supply your ${symbol} to the Sky Token Rewards module.`;
  }

  switch (batchStatus) {
    case BatchStatus.ENABLED:
      return msg`You're allowing this app to access the ${symbol} in your wallet and supply it to the Sky Token Rewards module in one bundled transaction.`;
    case BatchStatus.DISABLED:
      return msg`You're allowing this app to access the ${symbol} in your wallet and supply it to the Sky Token Rewards module in multiple transactions.`;
    default:
      return msg``;
  }
}

export function getRewardsWithdrawReviewSubtitle({ symbol }: { symbol: string }): MessageDescriptor {
  return msg`You will withdraw your ${symbol} from the Sky Token Rewards module.`;
}

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
        ? msg`Please allow this app to access the ${symbol} in your wallet and supply it to the Sky Token Rewards module.`
        : msg`Almost done!`;
    case TxStatus.LOADING:
      return needsAllowance
        ? msg`Your token approval and supply are being processed on the blockchain. Please wait.`
        : msg`Your transfer is being processed on the blockchain. Please wait.`;
    case TxStatus.SUCCESS:
      return msg`You’ve added ${symbol} to the Sky Token Rewards module.`;
    case TxStatus.ERROR:
      return msg`An error occurred during the supply flow.`;
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
  action,
  txStatus,
  selectedRewardContract,
  needsAllowance
}: {
  flow: RewardsFlow;
  action: RewardsAction;
  txStatus: TxStatus;
  selectedRewardContract: RewardContract;
  needsAllowance: boolean;
}): MessageDescriptor {
  switch (flow) {
    case RewardsFlow.SUPPLY:
      if (txStatus === TxStatus.SUCCESS && action === RewardsAction.SUPPLY) {
        return msg`${needsAllowance ? 'Approved and supplied' : 'Supplied'} ${selectedRewardContract.supplyToken.symbol} to Sky Token Rewards module`;
      } else {
        return msg`${needsAllowance ? 'Approving and supplying' : 'Supplying'} ${selectedRewardContract.supplyToken.symbol} to Sky Token Rewards module`;
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
