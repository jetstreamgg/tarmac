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

export const stakeOpenReviewTitle = msg`Begin the open position process`;
export const stakeManageReviewTitle = msg`Begin the change position process`;

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
      return msg`You're allowing this app to access the ${symbol} in your wallet and open a new Staking Rewards Engine position in one bundled transaction.`;
    case BatchStatus.DISABLED:
      return msg`You're allowing this app to access the ${symbol} in your wallet and open a new Staking Rewards Engine position in multiple transactions.`;
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
    return msg`You will update your Staking Rewards Engine position.`;
  }

  switch (batchStatus) {
    case BatchStatus.ENABLED:
      return msg`You're allowing this app to access the ${symbol} in your wallet and update your Staking Rewards Engine position in one bundled transaction.`;
    case BatchStatus.DISABLED:
      return msg`You're allowing this app to access the ${symbol} in your wallet and update your Staking Rewards Engine position in multiple transactions.`;
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
        : msg`Your transaction is being processed on the blockchain to update your position. Please wait.`;
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
      return msg`Error`;
  }
}

export function stakeLoadingButtonText({
  txStatus,
  flow
}: {
  flow: StakeFlow;
  txStatus: TxStatus;
}): MessageDescriptor {
  switch (txStatus) {
    case TxStatus.INITIALIZED:
      return msg`Waiting for confirmation`;
    default:
      return flow === StakeFlow.OPEN
        ? msg`Opening position`
        : flow === StakeFlow.MANAGE
          ? msg`Updating position`
          : msg`Loading`;
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

export const borrowRateTooltipText =
  'The Borrow Rate is determined by Sky Ecosystem Governance through a process of community-driven, decentralized onchain voting.';

export const collateralizationRatioTooltipText =
  'The ratio between the value of collateral you’ve provided and the amount you’ve borrowed against that collateral.';

export const liquidationPriceTooltipText =
  "If the value of your collateral (SKY) drops below the liquidation price noted here, some or all of your collateral may be auctioned to repay the amount of USDS that you borrowed. Note that a one-hour price update delay applies. In other words, when SKY drops below a user's liquidation price it will only start applying one hour later. This is called the OSM delay in technical terms, and it also applies to any legacy Maker MCD vault.";

export const riskLevelTooltipText =
  'Risk level indicates the likelihood of your collateral being liquidated. This is primarily determined by your Loan-to-Value (LTV) ratio, which represents the amount you’ve borrowed compared to the value of your crypto collateral. A high risk level means your collateral is close to the liquidation price threshold, and most vulnerable to market changes. A medium risk level means you have a reasonable balance between borrowing power and a safety buffer. A low risk level means you have a comparatively wider safety next against price fluctuations.';

export const debtCeilingTooltipText =
  'If the debt ceiling utilization reaches 100%, no new USDS can be borrowed. The debt ceiling is a parameter determined by Sky ecosystem governance through a process of decentralized onchain voting.';
