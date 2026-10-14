export type UpgradeHistoryRow = DaiUsdsRow | MkrSkyRow;
export type UpgradeHistory = Array<UpgradeHistoryRow>;
import { HistoryItem } from '../shared/shared';

export type UpgradeResponse<T> = Omit<T, 'blockTimestamp'> & {
  blockTimestamp: string;
  caller: string;
  usr: string;
};

export type UpgradeResponses<T extends DaiUsdsRow | MkrSkyRow> = Array<UpgradeResponse<T>>;

export type DaiUsdsRow = HistoryItem & {
  wad: bigint;
};

export type MkrSkyRow = HistoryItem & {
  mkrAmt: bigint;
  skyAmt: bigint;
};
