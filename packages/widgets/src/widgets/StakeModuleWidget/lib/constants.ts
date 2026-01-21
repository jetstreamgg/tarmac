import { msg } from '@lingui/core/macro';
import { MessageDescriptor } from '@lingui/core';
import { BatchStatus, TxStatus } from '@widgets/shared/constants';
import { TxCardCopyText } from '@widgets/shared/types/txCardCopyText';

export enum StakeFlow {
  OPEN = 'open',
  MANAGE = 'manage',
  CLAIM = 'claim'
}

export enum StakeAction {
  // Open flow can only do these two actions:
  APPROVE = 'approve',
  MULTICALL = 'multicall',

  OVERVIEW = 'overview',

  // These only need to be used if just a single action is being taken during manage flow:
  LOCK = 'lock',
  FREE = 'free',

  BORROW = 'borrow',
  REPAY = 'repay',

  REWARDS = 'rewards',
  DELEGATE = 'delegate',

  CLAIM = 'claim'
}

export enum StakeStep {
  OPEN_BORROW = 'open_borrow', // TODO: technically lock and borrow
  REWARDS = 'rewards',
  DELEGATE = 'delegate',
  SUMMARY = 'summary'
}

export enum StakeScreen {
  ACTION = 'action',
  TRANSACTION = 'transaction'
}

export function getStepTitle(step: StakeStep, tab: 'left' | 'right'): MessageDescriptor {
  switch (step) {
    case StakeStep.OPEN_BORROW:
      return tab === 'left' ? msg`Stake and Borrow` : msg`Unstake and pay back`;
    case StakeStep.REWARDS:
      return msg`Select reward`;
    case StakeStep.DELEGATE:
      return msg`Select a delegate`;
    case StakeStep.SUMMARY:
      return msg`Confirm your position`;
    default:
      return msg``;
  }
}

export function getStakeTitle(
  txStatus: Omit<TxStatus, TxStatus.CANCELLED>,
  flow: StakeFlow
): MessageDescriptor {
  switch (txStatus) {
    case TxStatus.INITIALIZED:
      return flow === StakeFlow.OPEN
        ? msg`Confirm your transaction`
        : msg`Confirm the change in your position`;
    case TxStatus.LOADING:
      return msg`In progress`;
    case TxStatus.SUCCESS:
      return msg`Success!`;
    case TxStatus.ERROR:
    case TxStatus.CANCELLED:
    default:
      return msg`Error`;
  }
}

export const stakeOpenReviewTitle = msg`Open your position`;
export const stakeManageReviewTitle = msg`Change your position`;

export function getStakeOpenReviewSubtitle({
  batchStatus,
  symbol,
  needsAllowance
}: {
  batchStatus: BatchStatus;
  symbol?: string;
  needsAllowance: boolean;
}): MessageDescriptor {
  if (!needsAllowance || !symbol) {
    return msg`You will open a new Staking Rewards Engine position.`;
  }

  switch (batchStatus) {
    case BatchStatus.ENABLED:
      return msg`You're allowing this app to access your ${symbol} and open a new position in one bundled transaction.`;
    case BatchStatus.DISABLED:
      return msg`You're allowing this app to access your ${symbol} and open a new position in multiple transactions.`;
    default:
      return msg``;
  }
}

export function getStakeManageReviewSubtitle({
  batchStatus,
  symbol,
  needsAllowance
}: {
  batchStatus: BatchStatus;
  symbol?: string;
  needsAllowance: boolean;
}): MessageDescriptor {
  if (!needsAllowance || !symbol) {
    return msg`You will change your Staking Rewards Engine position.`;
  }

  switch (batchStatus) {
    case BatchStatus.ENABLED:
      return msg`You're allowing this app to access your ${symbol} and change your position in one bundled transaction.`;
    case BatchStatus.DISABLED:
      return msg`You're allowing this app to access your ${symbol} and change your position in multiple transactions.`;
    default:
      return msg``;
  }
}

export function getStakeSubtitle({
  flow,
  txStatus,
  collateralToLock,
  borrowAmount,
  collateralToFree,
  borrowToRepay,
  selectedToken
}: {
  flow: StakeFlow;
  txStatus: Omit<TxStatus, TxStatus.CANCELLED>;
  collateralToLock?: string;
  borrowAmount?: string;
  collateralToFree?: string;
  borrowToRepay?: string;
  selectedToken?: string;
}): MessageDescriptor {
  switch (txStatus) {
    case TxStatus.INITIALIZED:
      return msg`Almost done!`;
    case TxStatus.LOADING:
      return flow === StakeFlow.OPEN
        ? msg`Your transaction is being processed on the blockchain to create your position. Please wait.`
        : msg`Your transaction is being processed on the blockchain to change your position. Please wait.`;
    case TxStatus.SUCCESS:
      return flow === StakeFlow.OPEN
        ? collateralToLock && borrowAmount
          ? msg`You've borrowed ${borrowAmount} USDS by staking ${collateralToLock} ${selectedToken ?? ''}. Your new position is open.`
          : collateralToLock
            ? msg`You've staked ${collateralToLock} ${selectedToken ?? ''}. Your new position is open.`
            : msg`You just opened your position`
        : collateralToFree && borrowToRepay
          ? msg`You've unstaked ${collateralToFree} ${selectedToken ?? ''} and repaid ${borrowToRepay} USDS to exit your position.`
          : collateralToFree
            ? msg`You've unstaked ${collateralToFree} ${selectedToken ?? ''} to exit your position.`
            : borrowToRepay
              ? msg`You've repaid ${borrowToRepay} USDS to exit your position.`
              : collateralToLock && borrowAmount
                ? msg`You've borrowed ${borrowAmount} USDS by staking ${collateralToLock} ${selectedToken ?? ''}. Your position is updated.`
                : collateralToLock
                  ? msg`You've staked ${collateralToLock} ${selectedToken ?? ''}. Your position is updated.`
                  : borrowAmount
                    ? msg`You've borrowed ${borrowAmount} USDS. Your position is updated.`
                    : msg`You just updated your position`;
    case TxStatus.ERROR:
    default:
      return flow === StakeFlow.OPEN
        ? msg`An error occurred while opening your position`
        : msg`An error occurred while changing your position`;
  }
}

export function stakeLoadingButtonText({
  txStatus,
  flow,
  action,
  amount,
  symbol
}: {
  flow: StakeFlow;
  txStatus: TxStatus;
  action?: StakeAction;
  amount?: string;
  symbol?: string;
}): MessageDescriptor {
  switch (txStatus) {
    case TxStatus.INITIALIZED:
      return msg`Waiting for confirmation`;
    case TxStatus.LOADING:
      if (action === StakeAction.APPROVE && amount && symbol) {
        return msg`Approving ${amount} ${symbol}`;
      }
      return flow === StakeFlow.OPEN
        ? msg`Opening position`
        : flow === StakeFlow.MANAGE
          ? msg`Changing position`
          : msg`Loading`;
    default:
      return msg`Loading`;
  }
}

export const claimTitle: TxCardCopyText = {
  [TxStatus.INITIALIZED]: msg`Claim your rewards`,
  [TxStatus.LOADING]: msg`In progress`,
  [TxStatus.SUCCESS]: msg`Successfully claimed your rewards`,
  [TxStatus.ERROR]: msg`Error`
};

export const claimSubtitle: TxCardCopyText = {
  [TxStatus.INITIALIZED]: msg`Please confirm that you want to claim your rewards directly to your wallet.`,
  [TxStatus.LOADING]: msg`Your claim is being processed on the blockchain. Please wait.`,
  [TxStatus.SUCCESS]: msg`You’ve claimed your rewards`,
  [TxStatus.ERROR]: msg`An error occurred while claiming your rewards`
};

export function claimLoadingButtonText({ txStatus }: { txStatus: TxStatus }): MessageDescriptor {
  switch (txStatus) {
    case TxStatus.INITIALIZED:
      return msg`Waiting for confirmation`;
    case TxStatus.LOADING:
      return msg`Claiming rewards`;
    default:
      return msg`Loading`;
  }
}
