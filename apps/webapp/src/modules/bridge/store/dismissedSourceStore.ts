import type { PendingBridge } from '../model/types';
import { parsePendingEntry } from './pendingStore';
import { createScopedListStore } from './scopedListStore';

const KEY_PREFIX = 'bridgeDismissed:v1:';

/** How long a dismissed send is still looked for on its chain. */
export const DISMISSED_WATCH_MS = 7 * 24 * 60 * 60 * 1000;

/** A bridge dismissed while its chain had no record of its send, kept to bring it back if the send shows up. */
export type DismissedBridge = { bridge: PendingBridge; dismissedAt: number };

const parse = (value: unknown): DismissedBridge | null => {
  if (typeof value !== 'object' || value === null) return null;
  const { bridge, dismissedAt } = value as Record<string, unknown>;
  const parsed = parsePendingEntry(bridge);
  return parsed?.txHash && typeof dismissedAt === 'number' ? { bridge: parsed, dismissedAt } : null;
};

export function createDismissedSourceStore({ now = Date.now }: { now?: () => number } = {}) {
  const list = createScopedListStore<DismissedBridge>({
    keyPrefix: KEY_PREFIX,
    parse,
    toJson: ({ bridge, dismissedAt }) => ({
      bridge: { ...bridge, amount: bridge.amount.toString() },
      dismissedAt
    }),
    idOf: entry => entry.bridge.id,
    retain: entry => entry.dismissedAt > now() - DISMISSED_WATCH_MS
  });
  const { latest, write } = list;

  return {
    subscribe: list.subscribe,
    getSnapshot: list.getSnapshot,
    add(scope: string, bridge: PendingBridge) {
      if (!bridge.txHash) return;
      const current = latest(scope).filter(entry => entry.bridge.id !== bridge.id);
      write(scope, [...current, { bridge, dismissedAt: now() }], bridge.id);
    },
    remove(scope: string, id: string) {
      const current = latest(scope);
      if (!current.some(entry => entry.bridge.id === id)) return;
      write(
        scope,
        current.filter(entry => entry.bridge.id !== id),
        id
      );
    }
  };
}

export const dismissedSourceStore = createDismissedSourceStore();
