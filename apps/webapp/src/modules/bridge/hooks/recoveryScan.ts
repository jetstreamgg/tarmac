import { lastCompleteScan } from '../store/recoveryScanStamp';

/** The scans of the deposit and withdrawal recoveries share their pace. */
export const RECOVERY_INTERVAL_MS = 30 * 60_000;
// A scan left partial is retried after 2 minutes, then 4, 8 and so on up to the interval.
export const PARTIAL_RETRY_MS = 2 * 60_000;

export const retryDelay = (retries: number) =>
  Math.min(PARTIAL_RETRY_MS * 2 ** (retries - 1), RECOVERY_INTERVAL_MS);

// Per kind and scope: bridges found settled are never read again this session.
const settledByKey = new Map<string, Set<string>>();
export const settledFor = (kind: string, scope: string) => {
  const key = `${kind}:${scope}`;
  const settled = settledByKey.get(key) ?? new Set<string>();
  settledByKey.set(key, settled);
  return settled;
};

/** The first scan of this load is skipped when a load in the last interval read everything. */
export const scannedRecently = (kind: string, scope: string, firstOfLoad: boolean) => {
  const stamp = lastCompleteScan(kind, scope);
  return firstOfLoad && stamp !== undefined && Date.now() - stamp < RECOVERY_INTERVAL_MS;
};
