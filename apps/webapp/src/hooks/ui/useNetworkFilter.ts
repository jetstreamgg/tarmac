import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { useChainId } from 'wagmi';
import { getSupportedChainIds } from '@/data/wagmi/config/chainFamily';
import {
  clampNetworkFilter,
  getNetworkFilter,
  setNetworkFilter,
  subscribeNetworkFilter,
  type NetworkFilter
} from '@/lib/networkFilter';

/**
 * React binding for the app-wide network filter (lib/networkFilter).
 *
 * Returns the filter already clamped to the connected chain family, so a
 * stored id the current family can't offer (a retired chain, or the dev fork
 * carried into a production session) reads as "All networks" rather than
 * emptying every table. The family is also returned because every consumer
 * builds its dropdown from it — all four surfaces must offer the same option
 * set, or a value chosen on one would be unrepresentable on another and Radix
 * would render a blank trigger.
 */
export function useNetworkFilter(): {
  /** The active filter: a chain id, or `null` for "All networks". */
  chainId: NetworkFilter;
  setChainId: (value: NetworkFilter) => void;
  /** The connected chain family — the option set every network filter offers. */
  supportedChainIds: number[];
} {
  const connectedChainId = useChainId();
  const stored = useSyncExternalStore(subscribeNetworkFilter, getNetworkFilter, getNetworkFilter);

  const supportedChainIds = useMemo(() => getSupportedChainIds(connectedChainId), [connectedChainId]);
  const chainId = useMemo(() => clampNetworkFilter(stored, supportedChainIds), [stored, supportedChainIds]);

  const setChainId = useCallback((value: NetworkFilter) => setNetworkFilter(value), []);

  return { chainId, setChainId, supportedChainIds };
}
