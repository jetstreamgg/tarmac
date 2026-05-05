import { msg } from '@lingui/core/macro';
import { MessageDescriptor } from '@lingui/core';
import { BatchStatus, TxStatus } from '@widgets/shared/constants';
import { TxCardCopyText } from '@widgets/shared/types/txCardCopyText';

export enum PendleFlow {
  BUY = 'buy',
  WITHDRAW = 'withdraw'
}

export enum PendleAction {
  APPROVE = 'approve',
  BUY = 'buy',
  WITHDRAW = 'withdraw'
}

export enum PendleScreen {
  ACTION = 'action',
  REVIEW = 'review',
  TRANSACTION = 'transaction'
}

export enum PendleSlippageType {
  AUTO = 'auto',
  CUSTOM = 'custom'
}

export const PENDLE_BUY_SLIPPAGE_STORAGE_KEY = 'pendle-buy-slippage';
export const PENDLE_SELL_SLIPPAGE_STORAGE_KEY = 'pendle-sell-slippage';

export const pendleSlippageConfig = {
  min: 0,
  max: 50
};

export const pendleBuyTitle: TxCardCopyText = {
  [TxStatus.INITIALIZED]: msg`Begin the supply process`,
  [TxStatus.LOADING]: msg`In progress`,
  [TxStatus.SUCCESS]: msg`Success!`,
  [TxStatus.ERROR]: msg`Error`
};

export const pendleWithdrawTitle: TxCardCopyText = {
  [TxStatus.INITIALIZED]: msg`Begin the withdraw process`,
  [TxStatus.LOADING]: msg`In progress`,
  [TxStatus.SUCCESS]: msg`Success!`,
  [TxStatus.ERROR]: msg`Error`
};

export const pendleBuyReviewTitle = msg`Begin the supply process`;
export const pendleWithdrawReviewTitle = msg`Begin the withdraw process`;
export const pendleRedeemReviewTitle = msg`Begin the redemption process`;

export function getPendleBuyReviewSubtitle({
  batchStatus,
  symbol,
  needsAllowance
}: {
  batchStatus: BatchStatus;
  symbol: string;
  needsAllowance: boolean;
}): MessageDescriptor {
  if (!needsAllowance) {
    return msg`You will supply your ${symbol} to the Pendle fixed-yield market.`;
  }
  switch (batchStatus) {
    case BatchStatus.ENABLED:
      return msg`You're allowing this app to access your ${symbol} and supply it to the Pendle market in one bundled transaction.`;
    case BatchStatus.DISABLED:
      return msg`You're allowing this app to access your ${symbol} and supply it to the Pendle market in multiple transactions.`;
    default:
      return msg``;
  }
}

export function getPendleWithdrawReviewSubtitle({
  batchStatus,
  ptSymbol,
  underlyingSymbol,
  needsAllowance
}: {
  batchStatus: BatchStatus;
  ptSymbol: string;
  underlyingSymbol: string;
  needsAllowance: boolean;
}): MessageDescriptor {
  if (!needsAllowance) {
    return msg`You will sell your ${ptSymbol} for ${underlyingSymbol} via Pendle.`;
  }
  switch (batchStatus) {
    case BatchStatus.ENABLED:
      return msg`You're allowing this app to access your ${ptSymbol} and sell it for ${underlyingSymbol} via Pendle in one bundled transaction.`;
    case BatchStatus.DISABLED:
      return msg`You're allowing this app to access your ${ptSymbol} and sell it for ${underlyingSymbol} via Pendle in multiple transactions.`;
    default:
      return msg``;
  }
}

export function getPendleRedeemReviewSubtitle(ptSymbol: string, underlyingSymbol: string): MessageDescriptor {
  return msg`You're allowing this app to redeem your ${ptSymbol} for ${underlyingSymbol} from the matured Pendle market.`;
}

export function getPendleActionDescription({
  flow,
  action,
  txStatus,
  isRedeem,
  needsAllowance,
  underlyingSymbol
}: {
  flow: PendleFlow;
  action: PendleAction | null;
  txStatus: TxStatus;
  isRedeem: boolean;
  needsAllowance: boolean;
  underlyingSymbol: string;
}): MessageDescriptor {
  if (
    (action === PendleAction.BUY || action === PendleAction.WITHDRAW) &&
    txStatus === TxStatus.SUCCESS
  ) {
    if (flow === PendleFlow.BUY) return msg`Supplied ${underlyingSymbol} to the Pendle fixed-yield market`;
    if (isRedeem) return msg`Redeemed PT-${underlyingSymbol} for ${underlyingSymbol}`;
    return msg`Sold PT-${underlyingSymbol} for ${underlyingSymbol} via Pendle`;
  }
  if (flow === PendleFlow.BUY) {
    return needsAllowance
      ? msg`Approving and supplying ${underlyingSymbol} to the Pendle fixed-yield market`
      : msg`Supplying ${underlyingSymbol} to the Pendle fixed-yield market`;
  }
  if (isRedeem) return msg`Redeeming PT-${underlyingSymbol} for ${underlyingSymbol} at maturity`;
  return needsAllowance
    ? msg`Approving and selling PT-${underlyingSymbol} for ${underlyingSymbol} via Pendle`
    : msg`Selling PT-${underlyingSymbol} for ${underlyingSymbol} via Pendle`;
}

// ---- Transaction-status copy ----

export function getPendleSupplySubtitle({
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
        ? msg`Please allow this app to access your ${symbol} and supply it to the Pendle market.`
        : msg`Almost done!`;
    case TxStatus.LOADING:
      return needsAllowance
        ? msg`Your token approval and supply are being processed on the blockchain. Please wait.`
        : msg`Your supply is being processed on the blockchain. Please wait.`;
    case TxStatus.SUCCESS:
      return msg`You've supplied ${amount} ${symbol} to the Pendle market.`;
    case TxStatus.ERROR:
      return msg`An error occurred during the supply flow.`;
    default:
      return msg``;
  }
}

export function getPendleWithdrawSubtitle({
  txStatus,
  amount,
  ptSymbol,
  underlyingSymbol,
  needsAllowance,
  isRedeem
}: {
  txStatus: TxStatus;
  amount: string;
  ptSymbol: string;
  underlyingSymbol: string;
  needsAllowance: boolean;
  isRedeem: boolean;
}): MessageDescriptor {
  switch (txStatus) {
    case TxStatus.INITIALIZED:
      return needsAllowance
        ? msg`Please allow this app to access your ${ptSymbol} and ${isRedeem ? 'redeem' : 'sell'} it via Pendle.`
        : msg`Almost done!`;
    case TxStatus.LOADING:
      return needsAllowance
        ? msg`Your token approval and ${isRedeem ? 'redemption' : 'withdrawal'} are being processed on the blockchain. Please wait.`
        : msg`Your ${isRedeem ? 'redemption' : 'withdrawal'} is being processed on the blockchain. Please wait.`;
    case TxStatus.SUCCESS:
      return isRedeem
        ? msg`You've redeemed ${amount} ${ptSymbol} for ${underlyingSymbol}.`
        : msg`You've withdrawn ${amount} ${ptSymbol} as ${underlyingSymbol}.`;
    case TxStatus.ERROR:
      return msg`An error occurred during the ${isRedeem ? 'redemption' : 'withdrawal'} flow.`;
    default:
      return msg``;
  }
}

export function getPendleSupplyLoadingButtonText({
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
      return msg`Supplying ${amount} ${symbol}`;
    default:
      return msg``;
  }
}

export function getPendleWithdrawLoadingButtonText({
  txStatus,
  amount,
  ptSymbol,
  isRedeem
}: {
  txStatus: TxStatus;
  amount: string;
  ptSymbol: string;
  isRedeem: boolean;
}): MessageDescriptor {
  switch (txStatus) {
    case TxStatus.INITIALIZED:
      return msg`Waiting for confirmation`;
    case TxStatus.LOADING:
      return isRedeem ? msg`Redeeming ${amount} ${ptSymbol}` : msg`Withdrawing ${amount} ${ptSymbol}`;
    default:
      return msg``;
  }
}
