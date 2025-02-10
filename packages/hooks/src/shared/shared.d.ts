import { ModuleEnum, TransactionTypeEnum } from '../constants';
import { SavingsSupply } from '../savings/savings';
import { ParsedTradeRecord } from '../trade/trade';
import { UpgradeHistoryRow } from '../upgrade/upgrade';

export interface HistoryItem {
  blockTimestamp: Date;
  transactionHash: string;
  module: ModuleEnum;
  type: TransactionTypeEnum;
  chainId: number;
}

export type CombinedHistoryItem = SavingsSupply & UpgradeHistoryRow & ParsedTradeRecord & HistoryItem;
