import { HistoryItem } from '../shared/shared.js';
import { OrderBalance, OrderQuoteSideKind, OrderStatus } from './constants.js';
import { ReadHook } from '../hooks.js';
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

type TradeRecordRaw = {
  uid: string;
  creationDate: string;
  owner: string;
  executedSellAmountBeforeFees: string;
  buyAmount: string;
  sellToken: `0x${string}`;
  buyToken: `0x${string}`;
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
};

export type TradeHistoryRaw = TradeRecord[];

export type TradeHistory = ParsedTradeRecord[];

export type GroupedTradeRecord = TradeRecord & {
  transactions: {
    amount: number;
    token: Token;
  }[];
};

export type TradeAllowanceHookResponse = ReadHook & {
  data?: bigint;
};

export type OrderQuoteSide =
  | { kind: OrderQuoteSideKind.BUY; buyAmountAfterFee: string }
  | { kind: OrderQuoteSideKind.SELL; sellAmountBeforeFee: string };

export type OrderParameters = {
  sellToken: `0x${string}`;
  buyToken: `0x${string}`;
  receiver: `0x${string}`;
  sellAmount: string;
  buyAmount: string;
  validTo: number;
  appData: `0x${string}`;
  feeAmount: string;
  kind: OrderQuoteSideKind;
  partiallyFillable: boolean;
  sellTokenBalance: OrderBalance;
  buyTokenBalance: OrderBalance.ERC20 | OrderBalance.INTERNAL;
  signingScheme: 'eip712' | 'ethsign' | 'presign' | 'eip1271';
};

export type OrderParametersWithFees = Omit<OrderParameters, 'sellAmount' | 'buyAmount' | 'feeAmount'> & {
  sellAmount: bigint;
  buyAmount: bigint;
  feeAmount: bigint;
  sellAmountBeforeFee: bigint;
  sellAmountAfterFee: bigint;
  buyAmountBeforeFee: bigint;
  buyAmountAfterFee: bigint;
  feeAmountInBuyToken: bigint;
  slippageTolerance: number;
  sellAmountToSign: bigint;
  buyAmountToSign: bigint;
  appDataHash: `0x${string}`;
};

export type OrderQuoteResponse = {
  quote: OrderParametersWithFees;
  from: `0x${string}`;
  expiration: string;
  id: number;
  verified: boolean;
};
