const PROBE_KEY = 'bridgeStorageProbe';

/** Whether localStorage takes a write now; false when it's disabled, full or throws. */
export function isStorageWritable(): boolean {
  try {
    localStorage.setItem(PROBE_KEY, '1');
    localStorage.removeItem(PROBE_KEY);
    return true;
  } catch {
    return false;
  }
}
