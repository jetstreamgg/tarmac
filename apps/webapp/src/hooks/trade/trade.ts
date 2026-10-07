import { HistoryItem } from '../shared/shared.js';
import { OrderStatus } from './constants.js';
import { ModuleEnum, TransactionTypeEnum } from '../constants.js';

export type Token = {
  id: string;
  symbol: string;
  name: string;
  decimals: number;
};

export type TradeRecord = HistoryItem & {
  id: string;
  pool: {
    id: string;
  };
  token0: Token;
  amount0: string;
  token1: Token;
  amount1: string;
  amountUSD: string;
  origin: string;
};

export type ParsedTradeRecord = Pick<TradeRecord, 'id' | 'blockTimestamp' | 'transactionHash' | 'origin'> & {
  fromAmount: bigint;
  fromToken: Token;
  toAmount: bigint;
  toToken: Token;
  cowOrderStatus: OrderStatus;
  module: ModuleEnum;
  type: TransactionTypeEnum;
  appCode?: string;
  chainId: number;
};

export type TradeHistory = ParsedTradeRecord[];
