import type { BridgeProgress } from '../model/pendingTransitions';
import type { PendingBridge } from '../model/types';

/**
 * What a route ticket implements for its bridge kind. The tracker calls
 * `checkProgress` on the poll interval once the source tx hash is known.
 */
export type BridgeAdapter = {
  /** Reads where a bridge stands; null when nothing changed since the last poll. */
  checkProgress: (bridge: PendingBridge, now: number) => Promise<BridgeProgress | null>;
};
