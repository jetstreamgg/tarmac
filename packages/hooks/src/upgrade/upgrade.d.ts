export type UpgradeHistoryRow = DaiUsdsRow | MkrSkyRow;
export type UpgradeHistory = Array<UpgradeHistoryRow>;
import { HistoryItem } from '../shared/shared';

export type UpgradeResponse<T> = Omit<T, 'blockTimestamp'> & {
  blockTimestamp: string;
  caller: string;
  usr: string;
};

export type UpgradeResponses = Array<UpgradeResponse>;

export type UpgradeTotalResponses = {
  total: bigint;
};

export type UpgradeTotals = {
  totalDaiUpgraded: bigint;
  totalMkrUpgraded: bigint;
  totalSkyUpgraded: bigint;
};

export type DaiUsdsRow = HistoryItem & {
  wad: bigint;
};

export type MkrSkyRow = HistoryItem & {
  mkrAmt: bigint;
  skyAmt: bigint;
};
