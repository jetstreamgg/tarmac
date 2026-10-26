import type { CctpL2NetworkId } from '../adapters/cctp/contracts';
import type { PendingBridge } from '../model/types';
import { unparsedEntries } from './unparsedEntries';

const KEY_PREFIX = 'bridgeCctpSwap:v1:';

/** A CCTP bridge whose USDS to USDC swap was sent on the L2 but whose burn never mined. */
export type UnfinishedCctpSwap = {
  /** The swap's tx hash, lowercase; the entry's id. */
  swapTxHash: string;
  network: CctpL2NetworkId;
  /** The USDC the swap returns, 6 decimals: what a continued bridge burns, and no more. */
  usdcAmount: bigint;
  /** The Ethereum recipient the bridge was for, lowercase. */
  recipient: string;
  at: number;
  /** The burn last sent for it, lowercase: its tx hash, or the wallet's calls id for a bundle. */
  burn?: string;
  /** The convert sent for its USDC on the L2, lowercase: its tx hash, or the wallet's calls id for a bundle. */
  convert?: string;
};

type Listener = () => void;

/** Whether a pending bridge is the burn a swap entry links to (`UnfinishedCctpSwap.burn`). */
export const isBurnOf = (bridge: PendingBridge, burn: string) =>
  [bridge.id, bridge.txHash, bridge.callsId].some(id => id?.toLowerCase() === burn);

/**
 * Whether a swap's USDC can still be spent, by a burn or a convert: none was
 * sent for it as a convert, and no burn was, or the last one's card failed or
 * is gone. A burn that may still land holds the USDC.
 */
export const isSwapSpendable = ({ burn, convert }: UnfinishedCctpSwap, bridges: readonly PendingBridge[]) => {
  if (convert) return false;
  if (!burn) return true;
  const bridge = bridges.find(entry => isBurnOf(entry, burn));
  // A burn with no card left to follow it: the chain checks still refuse one that mined.
  return !bridge || bridge.status === 'failed';
};

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
    typeof entry.at !== 'number' ||
    (entry.burn !== undefined && !isString(entry.burn)) ||
    (entry.convert !== undefined && !isString(entry.convert))
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
 * another tab. A write that fails keeps this session's change on top of what
 * storage holds, as the pending store does.
 */
export function createCctpSwapStore() {
  const listeners = new Set<Listener>();
  const snapshots = new Map<string, UnfinishedCctpSwap[]>();

  // Swaps whose last change reached only this session's copy (a write failed), by scope.
  const unsaved = new Map<string, Set<string>>();

  /** The stored list; undefined when storage can't be read. */
  const load = (scope: string): UnfinishedCctpSwap[] | undefined => {
    let raw: string | null;
    try {
      raw = localStorage.getItem(`${KEY_PREFIX}${scope}`);
    } catch {
      return undefined;
    }
    try {
      const parsed: unknown = JSON.parse(raw ?? '[]');
      return Array.isArray(parsed)
        ? parsed.map(parseEntry).filter((entry): entry is UnfinishedCctpSwap => entry !== null)
        : [];
    } catch {
      return [];
    }
  };

  /** The stored list with this session's unsaved changes on top: recorded or dropped. */
  const withUnsaved = (scope: string, stored: UnfinishedCctpSwap[]): UnfinishedCctpSwap[] => {
    const hashes = unsaved.get(scope);
    if (!hashes) return stored;
    const own = (snapshots.get(scope) ?? []).filter(entry => hashes.has(entry.swapTxHash));
    return [...own, ...stored.filter(entry => !hashes.has(entry.swapTxHash))];
  };

  const write = (scope: string, entries: UnfinishedCctpSwap[], changedHash: string) => {
    snapshots.set(scope, entries);
    try {
      // Entries a newer bundle wrote are kept, as the pending store does.
      const key = `${KEY_PREFIX}${scope}`;
      localStorage.setItem(
        key,
        JSON.stringify([
          ...entries.map(entry => ({ ...entry, usdcAmount: entry.usdcAmount.toString() })),
          ...unparsedEntries(key, entry => parseEntry(entry) !== null)
        ])
      );
      unsaved.delete(scope);
    } catch {
      // ignore storage write failures (private mode, quota); the session copy still updates
      unsaved.set(scope, new Set(unsaved.get(scope)).add(changedHash));
    }
    listeners.forEach(listener => listener());
  };

  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && !event.key.startsWith(KEY_PREFIX)) return;
    snapshots.forEach((_, scope) => {
      if (!unsaved.has(scope)) {
        snapshots.delete(scope);
        return;
      }
      const stored = load(scope);
      if (stored) snapshots.set(scope, withUnsaved(scope, stored));
    });
    listeners.forEach(listener => listener());
  };

  const getSnapshot = (scope: string): UnfinishedCctpSwap[] => {
    let snapshot = snapshots.get(scope);
    if (!snapshot) {
      snapshot = load(scope) ?? [];
      snapshots.set(scope, snapshot);
    }
    return snapshot;
  };

  // Writes start from storage, not this tab's copy, so another tab's write is not lost.
  const latest = (scope: string): UnfinishedCctpSwap[] => {
    const stored = load(scope);
    return stored ? withUnsaved(scope, stored) : getSnapshot(scope);
  };

  const clear = (scope: string, swapTxHash: string) => {
    const hash = swapTxHash.toLowerCase();
    const current = latest(scope);
    if (!current.some(entry => entry.swapTxHash === hash)) return;
    write(
      scope,
      current.filter(entry => entry.swapTxHash !== hash),
      hash
    );
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
    getSnapshot,
    /** Records a sent swap; one already recorded under its hash is kept. */
    record(scope: string, swap: UnfinishedCctpSwap) {
      const entry = {
        ...swap,
        swapTxHash: swap.swapTxHash.toLowerCase(),
        recipient: swap.recipient.toLowerCase()
      };
      const current = latest(scope);
      if (current.some(existing => existing.swapTxHash === entry.swapTxHash)) return;
      write(scope, [entry, ...current], entry.swapTxHash);
    },
    /** Links a swap to the burn sent for it, which replaces any earlier one; returns the one it replaced. */
    markBurn(scope: string, swapTxHash: string, burn: string): string | undefined {
      const hash = swapTxHash.toLowerCase();
      const id = burn.toLowerCase();
      const current = latest(scope);
      const entry = current.find(swap => swap.swapTxHash === hash);
      if (!entry || entry.burn === id) return undefined;
      write(
        scope,
        current.map(swap => (swap === entry ? { ...swap, burn: id } : swap)),
        hash
      );
      return entry.burn;
    },
    /** Links a swap to the convert sent for its USDC, or unlinks it with no `convert` (it reverted). */
    markConvert(scope: string, swapTxHash: string, convert: string | undefined) {
      const hash = swapTxHash.toLowerCase();
      const id = convert?.toLowerCase();
      const current = latest(scope);
      const entry = current.find(swap => swap.swapTxHash === hash);
      if (!entry || entry.convert === id) return;
      write(
        scope,
        current.map(swap => (swap === entry ? { ...swap, convert: id } : swap)),
        hash
      );
    },
    /** Drops a swap: it reverted or was replaced, or the user dismissed it. */
    clear,
    /** Drops the swaps whose burn mined, by any id that burn is known under. */
    clearBurned(scope: string, burns: readonly (string | undefined)[]) {
      const ids = new Set(burns.filter(isString).map(id => id.toLowerCase()));
      latest(scope)
        .filter(entry => entry.burn !== undefined && ids.has(entry.burn))
        .forEach(entry => clear(scope, entry.swapTxHash));
    }
  };
}

export type CctpSwapStore = ReturnType<typeof createCctpSwapStore>;

export const cctpSwapStore = createCctpSwapStore();
