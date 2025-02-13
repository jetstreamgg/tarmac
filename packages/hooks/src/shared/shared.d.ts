import { ModuleEnum, TransactionTypeEnum } from '../constants';
import { BaseTradeHistoryItem } from '../psm/useBaseTradeHistory';
import { RewardUserHistoryItem } from '../rewards/rewards';
import { SavingsSupply } from '../savings/savings';
import { SealHistoryItem } from '../seal/sealModule';
import { ParsedTradeRecord } from '../trade/trade';
import { DaiUsdsRow, MkrSkyRow } from '../upgrade/upgrade';

export interface HistoryItem {
  blockTimestamp: Date;
  transactionHash: string;
  module: ModuleEnum;
  type: TransactionTypeEnum;
}

export type CombinedHistoryItem =
  | SavingsSupply
  | DaiUsdsRow
  | MkrSkyRow
  | ParsedTradeRecord
  | RewardUserHistoryItem
  | SealHistoryItem
  | BaseTradeHistoryItem;
