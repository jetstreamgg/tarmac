import { HistoryItem } from '../../shared/shared';
import { Token } from '../../tokens/types';

export type SusdtVaultHistory = Array<SusdtVaultHistoryItem>;

export type SusdtVaultSupplyResponse = {
  assets: string;
  blockTimestamp: string;
  transactionHash: string;
};

export type SusdtVaultWithdrawResponse = {
  assets: string;
  blockTimestamp: string;
  transactionHash: string;
};

export type SusdtVaultSupply = HistoryItem & {
  assets: bigint;
  token: Token;
};

export type SusdtVaultWithdrawal = HistoryItem & {
  assets: bigint;
  token: Token;
};

export type SusdtVaultHistoryItem = SusdtVaultSupply | SusdtVaultWithdrawal;
