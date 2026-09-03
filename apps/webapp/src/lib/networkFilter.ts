/**
 * The app-wide network filter: one persisted "which network am I looking at"
 * value shared by every surface that scopes data by chain — the Portfolio
 * header, the Portfolio transactions toolbar, the Earn Opportunities toolbar
 * and the wallet drawer. Before this they each held private `useState`, so
 * changing one left the others behind.
 *
 * It is a DISPLAY filter, never a wallet action: selecting a network scopes
 * what is shown and nothing else. It feeds the connected chain in exactly one
 * place — `resolveModuleChain` (lib/widget-network-map), which prefers it when
 * the user opens a product page that runs on it.
 *
 * A module-level store rather than a context: consumers stay in sync with no
 * provider to mount, no subtree re-render on change, and the value stays
 * readable outside React (the navigation resolution reads it during a route
 * effect). `useNetworkFilter` (hooks/ui) is the React binding.
 *
 * Lives in lib rather than a module because all four consumers sit in
 * different modules and components/product may not import one (the EarnTable
 * layer rule), same as earnFilterMemory and portfolioDecisionCache.
 */

const STORAGE_KEY = 'skyNetworkFilter';

/** A chain id, or `null` for "All networks" (no filtering). */
export type NetworkFilter = number | null;

function readStored(): NetworkFilter {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    // Chain ids are positive integers; anything else is a stale or hand-edited
    // entry and reads as "All networks" rather than an unmatchable filter.
    return typeof parsed === 'number' && Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  } catch {
    return null;
  }
}

function persist(value: NetworkFilter): void {
  try {
    if (value === null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // ignore storage write failures (private mode, quota)
  }
}

let current: NetworkFilter = readStored();
const listeners = new Set<() => void>();

const emit = () => listeners.forEach(listener => listener());

/**
 * Cross-tab sync. Attached with the first subscriber rather than at module
 * scope so importing this file has no side effects (the node test runner has
 * no `window`), and detached with the last so nothing leaks between tests.
 */
const handleStorage = (event: StorageEvent) => {
  if (event.key !== null && event.key !== STORAGE_KEY) return;
  const next = readStored();
  if (next === current) return;
  current = next;
  emit();
};

/** The filter as stored — unclamped. React callers want `useNetworkFilter`. */
export function getNetworkFilter(): NetworkFilter {
  return current;
}

export function setNetworkFilter(value: NetworkFilter): void {
  if (value === current) return;
  current = value;
  persist(value);
  emit();
}

export function subscribeNetworkFilter(listener: () => void): () => void {
  if (listeners.size === 0) window.addEventListener('storage', handleStorage);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener('storage', handleStorage);
  };
}

/**
 * The filter as it applies to a given chain family. A stored id outside the
 * family — a retired chain, or the fork id carried over from a dev session
 * into a production one — reads as "All networks" instead of silently emptying
 * every table. Deliberately does NOT rewrite storage: switching a wallet onto
 * the Tenderly fork and back should restore the filter it had, not have lost
 * it in between.
 */
export function clampNetworkFilter(
  value: NetworkFilter,
  supportedChainIds: readonly number[]
): NetworkFilter {
  return value !== null && supportedChainIds.includes(value) ? value : null;
}

/** Test seam: resets the store and its storage entry to "All networks". */
export function resetNetworkFilterForTests(): void {
  current = null;
  persist(null);
  emit();
}
