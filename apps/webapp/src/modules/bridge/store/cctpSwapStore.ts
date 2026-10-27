import { CCTP_L2_NETWORKS, type CctpL2NetworkId } from '../adapters/cctp/contracts';
import type { PendingBridge } from '../model/types';
import { createScopedListStore } from './scopedListStore';

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
  /** `convert` is the wallet's calls id of a bundle, which only the wallet can resolve. */
  convertBundled?: true;
  /** When `convert` was linked, by the device clock. */
  convertAt?: number;
};

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

const NETWORKS = new Set<unknown>(CCTP_L2_NETWORKS);
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
    (entry.convert !== undefined && !isString(entry.convert)) ||
    (entry.convertBundled !== undefined && entry.convertBundled !== true) ||
    (entry.convertAt !== undefined && typeof entry.convertAt !== 'number')
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
  const list = createScopedListStore<UnfinishedCctpSwap>({
    keyPrefix: KEY_PREFIX,
    parse: parseEntry,
    toJson: entry => ({ ...entry, usdcAmount: entry.usdcAmount.toString() }),
    idOf: entry => entry.swapTxHash
  });
  const { latest, write } = list;

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
    subscribe: list.subscribe,
    getSnapshot: list.getSnapshot,
    /** The swap stored under that tx hash, in any case. */
    get: (scope: string, swapTxHash: string): UnfinishedCctpSwap | undefined =>
      list.getSnapshot(scope).find(entry => entry.swapTxHash === swapTxHash.toLowerCase()),
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
    /**
     * Links a swap to the convert sent for its USDC, by the wallet's calls id
     * with `bundle`, or unlinks it with no `convert` (it reverted).
     */
    markConvert(
      scope: string,
      swapTxHash: string,
      convert: string | undefined,
      { bundle = false }: { bundle?: boolean } = {}
    ) {
      const hash = swapTxHash.toLowerCase();
      const id = convert?.toLowerCase();
      const bundled = bundle ? (true as const) : undefined;
      const current = latest(scope);
      const entry = current.find(swap => swap.swapTxHash === hash);
      if (!entry || entry.convert === id) return;
      write(
        scope,
        current.map(swap =>
          swap === entry
            ? { ...swap, convert: id, convertBundled: bundled, convertAt: id ? Date.now() : undefined }
            : swap
        ),
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
