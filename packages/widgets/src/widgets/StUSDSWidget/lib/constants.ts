import { msg } from '@lingui/core/macro';
import { MessageDescriptor } from '@lingui/core';
import { BatchStatus, TxStatus } from '@widgets/shared/constants';
import { TxCardCopyText } from '@widgets/shared/types/txCardCopyText';

export enum StUSDSFlow {
  SUPPLY = 'supply',
  WITHDRAW = 'withdraw'
}

export enum StUSDSAction {
  APPROVE = 'approve',
  SUPPLY = 'supply',
  WITHDRAW = 'withdraw'
}

// Provider selection reason messages
export const providerMessages = {
  nativeProvider: msg`Native stUSDS contract`,
  curveProvider: msg`Curve pool`,
  usingCurveBetterRate: msg`Using Curve pool for better rate`,
  usingCurveNativeDepositBlocked: msg`Using Curve pool - native deposits unavailable`,
  usingCurveNativeWithdrawBlocked: msg`Using Curve pool - native withdrawals unavailable`,
  usingCurveSupplyCapReached: msg`Using Curve pool - supply cap reached`,
  usingCurveLiquidityExhausted: msg`Using Curve pool - liquidity exhausted`,
  allProvidersBlocked: msg`Both native and Curve routes are temporarily unavailable`,
  rateDifference: msg`Rate difference`
};

export enum StUSDSScreen {
  ACTION = 'action',
  REVIEW = 'review',
  TRANSACTION = 'transaction'
}

export const stusdsSupplyTitle: TxCardCopyText = {
  [TxStatus.INITIALIZED]: msg`Begin the supply process`,
  [TxStatus.LOADING]: msg`In progress`,
  [TxStatus.SUCCESS]: msg`Success!`,
  [TxStatus.ERROR]: msg`Error`
};

export const stusdsWithdrawTitle: TxCardCopyText = {
  [TxStatus.INITIALIZED]: msg`Begin the withdraw process`,
  [TxStatus.LOADING]: msg`In progress`,
  [TxStatus.SUCCESS]: msg`Success!`,
  [TxStatus.ERROR]: msg`Error`
};

export const stusdsSupplyReviewTitle = msg`Begin the supply process`;
export const stusdsWithdrawReviewTitle = msg`Begin the withdraw process`;
export function getStUSDSSupplyReviewSubtitle({
  batchStatus,
  symbol,
  needsAllowance,
  isCurve = false
}: {
  batchStatus: BatchStatus;
  symbol: string;
  needsAllowance: boolean;
  isCurve?: boolean;
}): MessageDescriptor {
  if (isCurve) {
    if (!needsAllowance) {
      return msg`You will supply your ${symbol} to the Curve pool for stUSDS.`;
    }
    switch (batchStatus) {
      case BatchStatus.ENABLED:
        return msg`You're allowing this app to access your ${symbol} and supply it to the Curve pool for stUSDS in one bundled transaction.`;
      case BatchStatus.DISABLED:
        return msg`You're allowing this app to access your ${symbol} and supply it to the Curve pool for stUSDS in multiple transactions.`;
      default:
        return msg``;
    }
  }

  if (!needsAllowance) {
    return msg`You will supply your ${symbol} to the stUSDS module to earn a rate through SKY-backed borrowing.`;
  }

  switch (batchStatus) {
    case BatchStatus.ENABLED:
      return msg`You're allowing this app to access your ${symbol} and supply it to the stUSDS module in one bundled transaction.`;
    case BatchStatus.DISABLED:
      return msg`You're allowing this app to access your ${symbol} and supply it to the stUSDS module in multiple transactions.`;
    default:
      return msg``;
  }
}
export function getStUSDSWithdrawReviewSubtitle({
  batchStatus,
  symbol,
  needsAllowance,
  isCurve = false
}: {
  batchStatus: BatchStatus;
  symbol: string;
  needsAllowance: boolean;
  isCurve?: boolean;
}): MessageDescriptor {
  if (isCurve) {
    if (!needsAllowance) {
      return msg`You will withdraw your stUSDS for ${symbol} via the Curve pool.`;
    }
    switch (batchStatus) {
      case BatchStatus.ENABLED:
        return msg`You're allowing this app to access your stUSDS and withdraw ${symbol} via the Curve pool in one bundled transaction.`;
      case BatchStatus.DISABLED:
        return msg`You're allowing this app to access your stUSDS and withdraw ${symbol} via the Curve pool in multiple transactions.`;
      default:
        return msg``;
    }
  }

  if (!needsAllowance) {
    return msg`You will withdraw your ${symbol} from the stUSDS module. Withdrawals may be delayed during periods of high utilization.`;
  }

  switch (batchStatus) {
    case BatchStatus.ENABLED:
      return msg`You're allowing this app to access your ${symbol} and withdraw from the stUSDS module in one bundled transaction.`;
    case BatchStatus.DISABLED:
      return msg`You're allowing this app to access your ${symbol} and withdraw from the stUSDS module in multiple transactions.`;
    default:
      return msg``;
  }
}

export function stusdsSupplySubtitle({
  txStatus,
  amount,
  symbol,
  needsAllowance,
  isCurve = false
}: {
  txStatus: TxStatus;
  amount: string;
  symbol: string;
  needsAllowance: boolean;
  isCurve?: boolean;
}): MessageDescriptor {
  if (isCurve) {
    switch (txStatus) {
      case TxStatus.INITIALIZED:
        return needsAllowance
          ? msg`Please allow this app to access your ${symbol} and supply it to the Curve pool.`
          : msg`Almost done!`;
      case TxStatus.LOADING:
        return needsAllowance
          ? msg`Your token approval and supply are being processed on the blockchain. Please wait.`
          : msg`Your supply to the Curve pool is being processed on the blockchain. Please wait.`;
      case TxStatus.SUCCESS:
        return msg`You've supplied ${amount} ${symbol} to the Curve pool for stUSDS`;
      case TxStatus.ERROR:
        return msg`An error occurred during the Curve pool supply.`;
      default:
        return msg``;
    }
  }

  switch (txStatus) {
    case TxStatus.INITIALIZED:
      return needsAllowance
        ? msg`Please allow this app to access your ${symbol} and supply it to the stUSDS module.`
        : msg`Almost done!`;
    case TxStatus.LOADING:
      return needsAllowance
        ? msg`Your token approval and supply are being processed on the blockchain. Please wait.`
        : msg`Your supply is being processed on the blockchain. Please wait.`;
    case TxStatus.SUCCESS:
      return msg`You've supplied ${amount} ${symbol} to the stUSDS module`;
    case TxStatus.ERROR:
      return msg`An error occurred during the supply flow.`;
    default:
      return msg``;
  }
}
export function stusdsWithdrawSubtitle({
  txStatus,
  amount,
  symbol,
  needsAllowance,
  isCurve = false
}: {
  txStatus: TxStatus;
  amount: string;
  symbol: string;
  needsAllowance: boolean;
  isCurve?: boolean;
}): MessageDescriptor {
  if (isCurve) {
    switch (txStatus) {
      case TxStatus.INITIALIZED:
        return needsAllowance
          ? msg`Please allow this app to access your stUSDS and withdraw it from the Curve pool.`
          : msg`Almost done!`;
      case TxStatus.LOADING:
        return needsAllowance
          ? msg`Your token approval and withdrawal are being processed on the blockchain. Please wait.`
          : msg`Your withdrawal via Curve is being processed on the blockchain. Please wait.`;
      case TxStatus.SUCCESS:
        return msg`You've withdrawn ${amount} ${symbol} from the Curve pool.`;
      case TxStatus.ERROR:
        return msg`An error occurred during the Curve withdrawal.`;
      default:
        return msg``;
    }
  }

  switch (txStatus) {
    case TxStatus.INITIALIZED:
      return needsAllowance
        ? msg`Please allow this app to access your ${symbol} and withdraw it from the stUSDS module.`
        : msg`Almost done!`;
    case TxStatus.LOADING:
      return needsAllowance
        ? msg`Your token approval and withdrawal are being processed on the blockchain. Please wait.`
        : msg`Your withdrawal is being processed on the blockchain. Please wait.`;
    case TxStatus.SUCCESS:
      return msg`You've withdrawn ${amount} ${symbol} from the stUSDS module.`;
    case TxStatus.ERROR:
      return msg`An error occurred during the withdraw flow.`;
    default:
      return msg``;
  }
}

export function stusdsSupplyLoadingButtonText({
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

export function stusdsWithdrawLoadingButtonText({
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

export function stusdsActionDescription({
  flow,
  action,
  txStatus,
  needsAllowance
}: {
  flow: StUSDSFlow;
  action: StUSDSAction;
  txStatus: TxStatus;
  needsAllowance: boolean;
}): MessageDescriptor {
  if ((action === StUSDSAction.SUPPLY || action === StUSDSAction.WITHDRAW) && txStatus === TxStatus.SUCCESS)
    return msg`${flow === StUSDSFlow.SUPPLY ? 'Approved and supplied to' : needsAllowance ? 'Approved and withdrawn from' : 'Withdrawn from'} the stUSDS module`;
  return needsAllowance
    ? msg`${flow === StUSDSFlow.SUPPLY ? 'Approving and supplying to' : 'Approving and withdrawing from'} the stUSDS module`
    : msg`${flow === StUSDSFlow.SUPPLY ? 'Supplying to' : 'Withdrawing from'} the stUSDS module`;
}
