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

// When the chain of each wallet bundle without a hash was last read, this session.
const bundleScans = new Map<string, number>();
export const bundleScannedAt = (scope: string, id: string) => bundleScans.get(`${scope}:${id}`);
export const markBundleScanned = (scope: string, ids: string[], at: number) =>
  ids.forEach(id => bundleScans.set(`${scope}:${id}`, at));

// After its send: 2, 6, 14 and 30 minutes.
const BUNDLE_SCAN_MARKS_MS = [1, 2, 3, 4].map(count =>
  Array.from({ length: count }, (_, i) => retryDelay(i + 1)).reduce((sum, delay) => sum + delay, 0)
);

/**
 * Whether the chain of a wallet bundle without a hash is due a read: at each
 * mark after its send, then once per interval. One never read is due from the
 * first mark.
 */
export const bundleScanDue = (startedAt: number, lastScanAt: number | undefined, now: number) =>
  lastScanAt === undefined
    ? now - startedAt >= BUNDLE_SCAN_MARKS_MS[0]
    : now - lastScanAt >= RECOVERY_INTERVAL_MS ||
      BUNDLE_SCAN_MARKS_MS.some(mark => lastScanAt < startedAt + mark && startedAt + mark <= now);
