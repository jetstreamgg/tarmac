import { useSyncExternalStore } from 'react';

/**
 * The current epoch time in milliseconds, as render-safe state.
 *
 * Calling `Date.now()` during render is impure: two renders of the same props
 * produce different output, a memo can't know its result went stale, and the
 * React Compiler (via `react-hooks/purity`) refuses to cache anything downstream
 * of it. So "now" has to come from somewhere React can see change — this hook
 * exposes it as an external store that ticks on a shared interval.
 *
 * The value is stable within a render (every call in the same pass reads the
 * same snapshot) and refreshes every `intervalMs` for as long as at least one
 * component is subscribed. Subscribers on the same interval share one timer, so
 * a page of countdowns costs one `setInterval`, and everything on it re-renders
 * in the same batch.
 *
 * Choose the interval by the coarsest unit the UI actually displays: 60s for a
 * days/hours/minutes countdown, finer only when a seconds figure is on screen.
 */
export function useNow(intervalMs: number): number {
  const store = getStore(intervalMs);
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}

type NowStore = {
  now: number;
  listeners: Set<() => void>;
  timer: ReturnType<typeof setInterval> | undefined;
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => number;
};

/** One store per interval, created on first use. */
const stores = new Map<number, NowStore>();

function getStore(intervalMs: number): NowStore {
  const existing = stores.get(intervalMs);
  if (existing) return existing;

  const store: NowStore = {
    now: Date.now(),
    listeners: new Set(),
    timer: undefined,
    subscribe: listener => {
      store.listeners.add(listener);
      if (store.listeners.size === 1) {
        store.timer = setInterval(() => {
          store.now = Date.now();
          store.listeners.forEach(notify => notify());
        }, intervalMs);
      }
      return () => {
        store.listeners.delete(listener);
        if (store.listeners.size === 0 && store.timer !== undefined) {
          clearInterval(store.timer);
          store.timer = undefined;
        }
      };
    },
    getSnapshot: () => {
      // While nobody is subscribed the timer is off, so the stored value only
      // ages. Refresh it for a fresh mount — but only once it has drifted a
      // whole interval, so consecutive calls within one render (React checks
      // the snapshot twice) keep returning the same number.
      if (store.listeners.size === 0 && Date.now() - store.now >= intervalMs) {
        store.now = Date.now();
      }
      return store.now;
    }
  };
  stores.set(intervalMs, store);
  return store;
}
