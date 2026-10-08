import type { BridgeProgress } from '../model/pendingTransitions';
import type { PendingBridge } from '../model/types';

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
  checkProgress: (bridge: PendingBridge, now: number) => Promise<BridgeProgress | null>;
};
