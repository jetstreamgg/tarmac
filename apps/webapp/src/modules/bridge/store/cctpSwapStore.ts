import type { CctpL2NetworkId } from '../adapters/cctp/contracts';

const KEY_PREFIX = 'bridgeCctpSwap:v1:';

/** A CCTP bridge whose USDS to USDC swap was sent on the L2 but whose burn never was. */
export type UnfinishedCctpSwap = {
  /** The swap's tx hash, lowercase; the entry's id. */
  swapTxHash: string;
  network: CctpL2NetworkId;
  /** The USDC the swap returns, 6 decimals: what a continued bridge burns, and no more. */
  usdcAmount: bigint;
  /** The Ethereum recipient the bridge was for, lowercase. */
  recipient: string;
  at: number;
};

type Listener = () => void;

const NETWORKS = new Set<unknown>(['base', 'optimism', 'unichain', 'arbitrum'] satisfies CctpL2NetworkId[]);
const isString = (value: unknown): value is string => typeof value === 'string';

const parseEntry = (value: unknown): UnfinishedCctpSwap | null => {
  if (typeof value !== 'object' || value === null) return null;
  const entry = value as Record<string, unknown>;
  if (
    !isString(entry.swapTxHash) ||
    !NETWORKS.has(entry.network) ||
    !isString(entry.usdcAmount) ||
    !isString(entry.recipient) ||
    typeof entry.at !== 'number'
  )
    return null;
  try {
    const usdcAmount = BigInt(entry.usdcAmount);
    return usdcAmount > 0n ? ({ ...entry, usdcAmount } as UnfinishedCctpSwap) : null;
  } catch {
    return null;
  }
};

/**
 * Unfinished CCTP swaps in localStorage, under the pending bridges' scope
 * (`pendingScopeKey`), so the bridge can be continued after a reload or from
 * another tab. A read or write that fails leaves this session's copy.
 */
export function createCctpSwapStore() {
  const listeners = new Set<Listener>();
  const snapshots = new Map<string, UnfinishedCctpSwap[]>();

  const load = (scope: string): UnfinishedCctpSwap[] => {
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(`${KEY_PREFIX}${scope}`) ?? '[]');
      return Array.isArray(parsed)
        ? parsed.map(parseEntry).filter((entry): entry is UnfinishedCctpSwap => entry !== null)
        : [];
    } catch {
      return snapshots.get(scope) ?? [];
    }
  };

  const write = (scope: string, entries: UnfinishedCctpSwap[]) => {
    snapshots.set(scope, entries);
    try {
      localStorage.setItem(
        `${KEY_PREFIX}${scope}`,
        JSON.stringify(entries.map(entry => ({ ...entry, usdcAmount: entry.usdcAmount.toString() })))
      );
    } catch {
      // ignore storage write failures (private mode, quota); the session copy still updates
    }
    listeners.forEach(listener => listener());
  };

  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && !event.key.startsWith(KEY_PREFIX)) return;
    snapshots.clear();
    listeners.forEach(listener => listener());
  };

  return {
    subscribe(listener: Listener) {
      if (listeners.size === 0) window.addEventListener('storage', onStorage);
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) window.removeEventListener('storage', onStorage);
      };
    },
    getSnapshot(scope: string): UnfinishedCctpSwap[] {
      let snapshot = snapshots.get(scope);
      if (!snapshot) {
        snapshot = load(scope);
        snapshots.set(scope, snapshot);
      }
      return snapshot;
    },
    /** Records a sent swap; one already recorded under its hash is kept. */
    record(scope: string, swap: UnfinishedCctpSwap) {
      const entry = {
        ...swap,
        swapTxHash: swap.swapTxHash.toLowerCase(),
        recipient: swap.recipient.toLowerCase()
      };
      const current = load(scope);
      if (current.some(existing => existing.swapTxHash === entry.swapTxHash)) return;
      write(scope, [entry, ...current]);
    },
    /** Drops a swap: its burn was sent, or the user dismissed it (a reverted swap is refused on Continue). */
    clear(scope: string, swapTxHash: string) {
      const hash = swapTxHash.toLowerCase();
      const current = load(scope);
      if (!current.some(entry => entry.swapTxHash === hash)) return;
      write(
        scope,
        current.filter(entry => entry.swapTxHash !== hash)
      );
    }
  };
}

export type CctpSwapStore = ReturnType<typeof createCctpSwapStore>;

export const cctpSwapStore = createCctpSwapStore();
