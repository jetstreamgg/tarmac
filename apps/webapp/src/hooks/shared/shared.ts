import { ModuleEnum, TransactionTypeEnum } from '../constants';
import { MorphoVaultHistoryItem } from '../morpho/morpho';
import { PendleHistoryItem } from '../pendle/pendle';
import { RewardUserHistoryItem } from '../rewards/rewards';
import { SavingsSupply } from '../savings/savings';
import { StakeHistoryItem } from '../stake/stakeModule';
import { StUsdsHistoryItem } from '../stusds/stusds';
import { ParsedTradeRecord } from '../trade/trade';
import { DaiUsdsRow, MkrSkyRow } from '../upgrade/upgrade';

export interface HistoryItem {
  blockTimestamp: Date;
  transactionHash: string;
  module: ModuleEnum;
  type: TransactionTypeEnum;
  chainId: number;
}

export type CombinedHistoryItem =
  | SavingsSupply
  | DaiUsdsRow
  | MkrSkyRow
  | ParsedTradeRecord
  | RewardUserHistoryItem
  | StakeHistoryItem
  | StUsdsHistoryItem
  | MorphoVaultHistoryItem
  | PendleHistoryItem;
