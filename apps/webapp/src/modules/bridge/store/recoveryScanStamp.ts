const KEY_PREFIX = 'bridgeRecoveryScan:v1:';

/** When a recovery scan of `kind` last read everything for `scope`; undefined when unknown or unreadable. */
export function lastCompleteScan(kind: string, scope: string): number | undefined {
  try {
    const at = Number(localStorage.getItem(`${KEY_PREFIX}${kind}:${scope}`));
    return Number.isFinite(at) && at > 0 ? at : undefined;
  } catch {
    return undefined;
  }
}

/** Records that a recovery scan of `kind` read everything for `scope` at `at`. */
export function markCompleteScan(kind: string, scope: string, at: number) {
  try {
    localStorage.setItem(`${KEY_PREFIX}${kind}:${scope}`, String(at));
  } catch {
    // Unstored, the next load scans again.
  }
}
