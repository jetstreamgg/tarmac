/**
 * How many rows the positions table showed last time for this wallet, so the
 * next load's skeleton has the same height and the table does not resize
 * when the live list lands (most owners have one or two positions; the
 * generic skeleton is four rows).
 */
const KEY_PREFIX = 'stake:positionCount:v1';

const key = (chainId: number, address: string) => `${KEY_PREFIX}:${chainId}:${address.toLowerCase()}`;

export function rememberStakePositionCount(chainId: number, address: string, count: number): void {
  try {
    localStorage.setItem(key(chainId, address), String(count));
  } catch {
    // ignore storage write failures (private mode, quota)
  }
}

/** The remembered count, or undefined when this wallet has not loaded the list before. */
export function recallStakePositionCount(chainId: number, address: string | undefined): number | undefined {
  if (!address) return undefined;
  try {
    const stored = Number(localStorage.getItem(key(chainId, address)));
    return Number.isInteger(stored) && stored > 0 ? stored : undefined;
  } catch {
    return undefined;
  }
}
