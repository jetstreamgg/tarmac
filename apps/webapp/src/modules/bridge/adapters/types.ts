import type { PublicClient } from 'viem';
import type { BridgeProgress } from '../model/pendingTransitions';
import type { BridgeNetworkId } from '../model/networks';
import type { PendingBridge } from '../model/types';

/** The chain reads a route adapter makes. */
export type ChainReader = Pick<PublicClient, 'getTransactionReceipt' | 'readContract'>;

export type AdapterContext = {
  /** The network's configured client; undefined when the app has none for it. */
  getClient: (network: BridgeNetworkId) => ChainReader | undefined;
};

/**
 * What a route ticket implements for its bridge kind. The tracker calls
 * `checkProgress` on the poll interval once the source tx hash is known.
 *
 * Every adapter must settle each `sent` action, by the hash it was sent with,
 * with `action-confirmed` or `action-dropped`; until it does, that action can't
 * be sent again. A Safe's sent action (`safe`) is settled by the tracker from
 * the Safe Transaction Service instead. After each confirmed action it must report `waiting` with the
 * next step's `etaAt`, or the card shows the bridge as overdue.
 */
export type BridgeAdapter = {
  /** Reads where a bridge stands; null when nothing changed since the last poll. */
  checkProgress: (
    bridge: PendingBridge,
    now: number,
    context: AdapterContext
  ) => Promise<BridgeProgress | null>;
};
