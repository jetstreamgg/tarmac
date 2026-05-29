import { msg } from '@lingui/core/macro';
import { MessageDescriptor } from '@lingui/core';
import { BatchStatus, TxStatus } from '@/widgets/shared/constants';
import { TxCardCopyText } from '@/widgets/shared/types/txCardCopyText';

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

// Pendle's /v1/pnl/transactions indexer lag is empirically ~19s after the
// block is mined (n=2 against a real wallet, May 2026 — both samples in
// 17.3–21.3s, suggesting a steady ~20s poll on Pendle's side rather than a
// long tail). 25s gives a 4–8s safety margin; rare outliers beyond that are
// covered by `refetchOnWindowFocus` and `staleTime: 0` on the shared query.
// Much higher than the global REFRESH_DELAY (1s) the other widgets use
// because those histories are powered by our Envio Hyperindex (or the Morpho
// API for vaults), which surface new rows within a block. Pendle's PnL
// endpoint is a third-party indexer we don't control — re-measure if it
// changes.
export const PENDLE_HISTORY_REFRESH_MS = 25_000;

export const PENDLE_BUY_SLIPPAGE_STORAGE_KEY = 'pendle-buy-slippage';
export const PENDLE_SELL_SLIPPAGE_STORAGE_KEY = 'pendle-sell-slippage';
/** Matured-PT redeem flow gets its own key — separate default from buy/sell
 * so users can hold a different tolerance per flow. */
export const PENDLE_REDEEM_SLIPPAGE_STORAGE_KEY = 'pendle-redeem-slippage';
/** 0.02% — applied to matured-PT redeem (vs. 0.2% for buy/sell). */
export const PENDLE_DEFAULT_REDEEM_SLIPPAGE = 0.0002;

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
    return msg`You will supply your ${symbol} to the fixed-yield market.`;
  }
  switch (batchStatus) {
    case BatchStatus.ENABLED:
      return msg`You're allowing this app to access your ${symbol} and supply it to the market in one bundled transaction.`;
    case BatchStatus.DISABLED:
      return msg`You're allowing this app to access your ${symbol} and supply it to the market in multiple transactions.`;
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
    return msg`You will sell your ${ptSymbol} for ${underlyingSymbol}.`;
  }
  switch (batchStatus) {
    case BatchStatus.ENABLED:
      return msg`You're allowing this app to access your ${ptSymbol} and sell it for ${underlyingSymbol} in one bundled transaction.`;
    case BatchStatus.DISABLED:
      return msg`You're allowing this app to access your ${ptSymbol} and sell it for ${underlyingSymbol} in multiple transactions.`;
    default:
      return msg``;
  }
}

export function getPendleActionDescription({
  flow,
  action,
  txStatus,
  needsAllowance,
  underlyingSymbol
}: {
  flow: PendleFlow;
  action: PendleAction | null;
  txStatus: TxStatus;
  needsAllowance: boolean;
  underlyingSymbol: string;
}): MessageDescriptor {
  if ((action === PendleAction.BUY || action === PendleAction.WITHDRAW) && txStatus === TxStatus.SUCCESS) {
    if (flow === PendleFlow.BUY) return msg`Supplied ${underlyingSymbol} to the fixed-yield market`;
    return msg`Sold PT-${underlyingSymbol} for ${underlyingSymbol}`;
  }
  if (flow === PendleFlow.BUY) {
    return needsAllowance
      ? msg`Approving and supplying ${underlyingSymbol} to the fixed-yield market`
      : msg`Supplying ${underlyingSymbol} to the fixed-yield market`;
  }
  return needsAllowance
    ? msg`Approving and selling PT-${underlyingSymbol} for ${underlyingSymbol}`
    : msg`Selling PT-${underlyingSymbol} for ${underlyingSymbol}`;
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
        ? msg`Please allow this app to access your ${symbol} and supply it to the market.`
        : msg`Almost done!`;
    case TxStatus.LOADING:
      return needsAllowance
        ? msg`Your token approval and supply are being processed on the blockchain. Please wait.`
        : msg`Your supply is being processed on the blockchain. Please wait.`;
    case TxStatus.SUCCESS:
      return msg`You've supplied ${amount} ${symbol} to the market.`;
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
  needsAllowance
}: {
  txStatus: TxStatus;
  amount: string;
  ptSymbol: string;
  underlyingSymbol: string;
  needsAllowance: boolean;
}): MessageDescriptor {
  switch (txStatus) {
    case TxStatus.INITIALIZED:
      return needsAllowance
        ? msg`Please allow this app to access your ${ptSymbol} and sell it.`
        : msg`Almost done!`;
    case TxStatus.LOADING:
      return needsAllowance
        ? msg`Your token approval and withdrawal are being processed on the blockchain. Please wait.`
        : msg`Your withdrawal is being processed on the blockchain. Please wait.`;
    case TxStatus.SUCCESS:
      return msg`You've withdrawn ${amount} ${ptSymbol} as ${underlyingSymbol}.`;
    case TxStatus.ERROR:
      return msg`An error occurred during the withdrawal flow.`;
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
  ptSymbol
}: {
  txStatus: TxStatus;
  amount: string;
  ptSymbol: string;
}): MessageDescriptor {
  switch (txStatus) {
    case TxStatus.INITIALIZED:
      return msg`Waiting for confirmation`;
    case TxStatus.LOADING:
      return msg`Withdrawing ${amount} ${ptSymbol}`;
    default:
      return msg``;
  }
}
