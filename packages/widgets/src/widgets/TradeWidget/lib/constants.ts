import { TxCardCopyTextWithCancel } from '@widgets/shared/types/txCardCopyText';
import { TxStatus } from '@widgets/shared/constants';
import { msg } from '@lingui/core/macro';
import { MessageDescriptor } from '@lingui/core';
import { Token } from '@jetstreamgg/sky-hooks';
import { EthTxCardCopyText } from './types';

export enum TradeFlow {
  TRADE = 'trade'
}

export enum TradeAction {
  APPROVE = 'approve',
  TRADE = 'trade'
}

export enum TradeScreen {
  ACTION = 'action',
  REVIEW = 'review',
  TRANSACTION = 'transaction'
}

export enum TradeSide {
  IN = 'IN',
  OUT = 'OUT'
}

export enum EthFlowTxStatus {
  IDLE = 'idle',
  INITIALIZED = 'initialized',
  SENDING_ETH = 'sending-eth',
  CREATING_ORDER = 'creating-order',
  ORDER_CREATED = 'order-created',
  SUCCESS = 'success',
  CANCELLED = 'cancelled',
  ERROR = 'error'
}

export const tradeApproveTitle: TxCardCopyTextWithCancel = {
  [TxStatus.INITIALIZED]: msg`Approve token access`,
  [TxStatus.LOADING]: msg`In progress`,
  [TxStatus.SUCCESS]: msg`Token access approved`,
  [TxStatus.ERROR]: msg`Error`,
  [TxStatus.CANCELLED]: msg`Cancelled`
};

export function tradeApproveSubtitle(txStatus: TxStatus, symbol: string): MessageDescriptor {
  switch (txStatus) {
    case TxStatus.INITIALIZED:
      return msg`Please allow this app to access your ${symbol}.`;
    case TxStatus.LOADING:
      return msg`Token access approval in progress.`;
    case TxStatus.SUCCESS:
      return msg`Next, confirm the transaction in your wallet.`;
    case TxStatus.ERROR:
      return msg`An error occurred while allowing the app to access your ${symbol}.`;
    default:
      return msg`Unknown status.`;
  }
}

export function tradeApproveDescription({
  originToken,
  targetToken
}: {
  originToken: Token;
  targetToken: Token;
}): MessageDescriptor {
  return msg`Trading ${originToken.symbol} for ${targetToken.symbol}`;
}

export const tradeTitle: TxCardCopyTextWithCancel = {
  [TxStatus.INITIALIZED]: msg`Confirm your trade`,
  [TxStatus.LOADING]: msg`In progress`,
  [TxStatus.SUCCESS]: msg`Trade completed`,
  [TxStatus.ERROR]: msg`Error`,
  [TxStatus.CANCELLED]: msg`Order cancelled`
};

export function tradeSubtitle({
  txStatus,
  originToken,
  originAmount,
  targetToken,
  targetAmount
}: {
  txStatus: TxStatus;
  originToken: Token;
  originAmount: string;
  targetToken: Token;
  targetAmount: string;
}): MessageDescriptor {
  switch (txStatus) {
    case TxStatus.INITIALIZED:
      return msg`Almost done!`;
    case TxStatus.LOADING:
      return msg`Your trade is being processed on the blockchain. Please wait.`;
    case TxStatus.SUCCESS:
      return msg`You received ${targetAmount} ${targetToken.symbol} for ${originAmount} ${originToken.symbol}.`;
    case TxStatus.ERROR:
      return msg`An error occurred while trading your tokens`;
    case TxStatus.CANCELLED:
      return msg`Your cancellation request has been placed`;
    default:
      return msg`Unknown status.`;
  }
}

export function tradeDescription({
  originToken,
  targetToken,
  txStatus,
  executionPrice
}: {
  originToken: Token;
  targetToken: Token;
  txStatus: TxStatus;
  executionPrice?: string;
}): MessageDescriptor {
  if (txStatus === TxStatus.CANCELLED)
    return msg`Be sure to check your transaction status on CoW Explorer to verify the cancellation was successful`;
  if (!executionPrice) return msg`Trading ${originToken.symbol} for ${targetToken.symbol}`;
  return msg`1 ${targetToken.symbol} = ${executionPrice} ${originToken.symbol}`;
}

export function tradeLoadingButtonText({ txStatus }: { txStatus: TxStatus }): MessageDescriptor {
  switch (txStatus) {
    case TxStatus.INITIALIZED:
      return msg`Waiting for confirmation`;
    case TxStatus.LOADING:
      return msg`Trading`;
    default:
      return msg``;
  }
}

export enum SUPPORTED_TOKEN_SYMBOLS {
  ETH = 'ETH',
  WETH = 'WETH',
  USDC = 'USDC',
  USDT = 'USDT',
  DAI = 'DAI',
  USDS = 'USDS',
  sUSDS = 'sUSDS',
  MKR = 'MKR',
  SKY = 'SKY'
}

export const ETH_SLIPPAGE_STORAGE_KEY = 'eth-trade-slippage';
export const ERC_SLIPPAGE_STORAGE_KEY = 'erc-trade-slippage';

export const ercFlowSlippageConfig = {
  min: 0,
  max: 50,
  default: 0.5
};
export const ethFlowSlippageConfig = {
  min: 2,
  max: 50,
  default: 2
};

export const MAX_SLIPPAGE_WITHOUT_WARNING = 2;
export const MAX_FEE_PERCENTAGE_WITHOUT_WARNING = 10;

export enum SlippageType {
  AUTO = 'auto',
  CUSTOM = 'custom'
}

export const ethFlowTradeTitle: EthTxCardCopyText = {
  [EthFlowTxStatus.INITIALIZED]: msg`Confirm your trade`,
  [EthFlowTxStatus.SENDING_ETH]: msg`Sending ETH`,
  [EthFlowTxStatus.CREATING_ORDER]: msg`Creating order`,
  [EthFlowTxStatus.ORDER_CREATED]: msg`Order created`,
  [EthFlowTxStatus.SUCCESS]: msg`Trade completed`,
  [EthFlowTxStatus.ERROR]: msg`Error`,
  [EthFlowTxStatus.CANCELLED]: msg`Order cancelled`
};

export function ethFlowTradeSubtitle({
  ethFlowTxStatus,
  originToken,
  originAmount,
  targetToken,
  targetAmount
}: {
  ethFlowTxStatus: EthFlowTxStatus;
  originToken: Token;
  originAmount: string;
  targetToken: Token;
  targetAmount: string;
}): MessageDescriptor {
  switch (ethFlowTxStatus) {
    case EthFlowTxStatus.INITIALIZED:
      return msg`You are now trading ${originAmount} ${originToken.symbol}. You will receive ${targetAmount} ${targetToken.symbol}`;
    case EthFlowTxStatus.SENDING_ETH:
      return msg`Sending ${originAmount} ${originToken.symbol} to the contract`;
    case EthFlowTxStatus.CREATING_ORDER:
      return msg`Creating order to trade ${originAmount} ${originToken.symbol} for ${targetAmount} ${targetToken.symbol}`;
    case EthFlowTxStatus.ORDER_CREATED:
      return msg`Waiting for the order to be executed by a solver to trade ${originAmount} ${originToken.symbol} for ${targetAmount} ${targetToken.symbol}`;
    case EthFlowTxStatus.SUCCESS:
      return msg`You successfully traded ${originAmount} ${originToken.symbol} for ${targetAmount} ${targetToken.symbol}`;
    case EthFlowTxStatus.ERROR:
      return msg`An error occurred while trading your tokens`;
    case EthFlowTxStatus.CANCELLED:
      return msg`Your cancellation request has been placed`;
    default:
      return msg`Unknown status`;
  }
}

export function ethFlowTradeDescription({
  originToken,
  targetToken,
  ethFlowTxStatus,
  executionPrice
}: {
  originToken: Token;
  targetToken: Token;
  ethFlowTxStatus: EthFlowTxStatus;
  executionPrice?: string;
}): MessageDescriptor {
  if (ethFlowTxStatus === EthFlowTxStatus.CANCELLED)
    return msg`Be sure to check your transaction status on CoW Explorer to verify the cancellation was successful`;
  if (!executionPrice) return msg`Trading ${originToken.symbol} for ${targetToken.symbol}`;
  return msg`1 ${targetToken.symbol} = ${executionPrice} ${originToken.symbol}`;
}

export function ethFlowTradeLoadingButtonText({
  ethFlowTxStatus
}: {
  ethFlowTxStatus: EthFlowTxStatus;
}): MessageDescriptor {
  switch (ethFlowTxStatus) {
    case EthFlowTxStatus.INITIALIZED:
      return msg`Waiting for confirmation`;
    case EthFlowTxStatus.SENDING_ETH:
    case EthFlowTxStatus.CREATING_ORDER:
    case EthFlowTxStatus.ORDER_CREATED:
      return msg`Trading`;
    default:
      return msg``;
  }
}

export enum HandledQuoteErrorTypes {
  NoLiquidity = 'NoLiquidity',
  SellAmountDoesNotCoverFee = 'SellAmountDoesNotCoverFee'
}
