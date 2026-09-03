import { useCallback, useEffect, useMemo, useState } from 'react';
import type { EarnRiskTier } from '@/hooks';
// Direct path rather than the '@/hooks' barrel: this is the only value import
// the hook needs from that layer, and the barrel pulls every hook module in.
import { useNetworkFilter } from '@/hooks/ui/useNetworkFilter';
import type { EarnTableColumn, EarnTableSort } from '@/components/product/EarnTable';
import { useRouterState } from '@tanstack/react-router';
import { QueryParams } from '@/lib/constants';
import { isEarnMarketplacePath } from '@/lib/routes';
import { useAppSearchParams } from '@/lib/navigation';
import { rememberEarnFilterSearch } from '@/lib/earnFilterMemory';
import {
  DEFAULT_FILTERS,
  DEFAULT_SORT,
  defaultDirectionFor,
  sanitizeFilters,
  EarnFilterOptionValues,
  EarnTableFiltersState
} from '../helpers/earnTableState';

const FILTERS_STORAGE_KEY = 'earnOpportunitiesFilters';

// Only the risk filter is a saved preference here; stablecoin/product live in
// the URL and network lives in the shared network-filter store. Keeps just the
// risk field, so legacy full-object storage is read without resurrecting the
// other persisted filters.
function readStoredRisk(): EarnRiskTier[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(FILTERS_STORAGE_KEY) || 'null');
    if (typeof stored !== 'object' || stored === null) return DEFAULT_FILTERS.risk;
    // sanitizeFilters validates the tiers; the option sets it also checks are
    // irrelevant to risk, so any empty set will do.
    return sanitizeFilters(stored, { stablecoins: [], products: [] }).risk;
  } catch {
    return DEFAULT_FILTERS.risk;
  }
}

function writeStoredRisk(risk: EarnRiskTier[]): void {
  try {
    localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify({ risk }));
  } catch {
    // ignore storage write failures
  }
}

/** URL param backing each of the two query-driven filters. */
const PARAM_BY_FILTER = {
  stablecoin: QueryParams.Token,
  product: QueryParams.Product
} as const;

type UrlFilterKey = keyof typeof PARAM_BY_FILTER;

/**
 * Filter + sort state of the Earn Opportunities table.
 *
 * Stablecoin and product live in the search string (APP-457): that is what
 * survives a back-navigation from a product page, and what the navbar's Earn
 * link clears by virtue of `retainOnNavigate` dropping every param but
 * `network`. Risk stays a saved preference in localStorage, and sort is
 * ephemeral — it resets to its default on every visit.
 *
 * Network is neither: it is the app-wide filter (lib/networkFilter), shared
 * with the Portfolio header, the transactions toolbar and the wallet drawer.
 * It used to be a third URL filter (`?chain=`), but nothing in the app ever
 * produced such a link and a bookmarked one would now silently rewrite a
 * global preference — so it moved into the store with the rest of them. As a
 * global preference it also outlives the navbar's Earn reset, unlike the two
 * table-local filters.
 */
export function useEarnTableState(validOptions: EarnFilterOptionValues) {
  const [searchParams, setSearchParams] = useAppSearchParams();
  const pathname = useRouterState({ select: state => state.location.pathname });
  const [risk, setRisk] = useState<EarnRiskTier[]>(readStoredRisk);
  const [sort, setSort] = useState<EarnTableSort>(DEFAULT_SORT);
  const { chainId: network, setChainId: setNetwork } = useNetworkFilter();

  const { stablecoins, products } = validOptions;

  // Values the URL is asking for. Sanitizing on read (rather than rewriting the
  // URL) is deliberate: the option sets arrive asynchronously, so a deep link
  // would otherwise be scrubbed before its value ever became valid.
  const filters = useMemo<EarnTableFiltersState>(
    () =>
      sanitizeFilters(
        {
          risk,
          network,
          // Callers deep-link the symbol as it's displayed (/earn?token=USDS);
          // filter values are the lowercase option values.
          stablecoin: searchParams.get(PARAM_BY_FILTER.stablecoin)?.toLowerCase(),
          product: searchParams.get(PARAM_BY_FILTER.product)
        },
        { stablecoins, products }
      ),
    [risk, network, searchParams, stablecoins, products]
  );

  // What "Back to products" restores. Written on every change, empty object
  // included — landing on a clean /earn is what wipes a stale memory.
  //
  // The pathname guard is load-bearing: `useAppSearchParams` reads the router's
  // *global* location, so on the way out of the marketplace this component
  // re-renders once with the destination's search before it unmounts. Without
  // the guard that render records the product page's (filter-less) search, and
  // the back link it feeds lands on an unfiltered /earn.
  useEffect(() => {
    if (!isEarnMarketplacePath(pathname)) return;
    rememberEarnFilterSearch(Object.fromEntries(searchParams));
  }, [pathname, searchParams]);

  // `replace` keeps filter fiddling out of the history stack: back still leaves
  // /earn in one press, while the /earn entry itself carries the latest filters.
  // `resetScroll: false` keeps the viewport at the filter bar the user is
  // interacting with, instead of the router's default jump back to the top.
  const setFilterParams = useCallback(
    (update: Partial<Record<UrlFilterKey, string>>) => {
      setSearchParams(
        prev => {
          const next = new URLSearchParams(prev);
          for (const [key, value] of Object.entries(update)) {
            const param = PARAM_BY_FILTER[key as UrlFilterKey];
            if (value === undefined || value === 'all') next.delete(param);
            else next.set(param, value);
          }
          return next;
        },
        { replace: true, resetScroll: false }
      );
    },
    [setSearchParams]
  );

  const updateFilters = useCallback(
    (update: Partial<EarnTableFiltersState>) => {
      const { risk: nextRisk, network: nextNetwork, ...urlUpdate } = update;
      if (nextRisk) {
        setRisk(nextRisk);
        writeStoredRisk(nextRisk);
      }
      if (nextNetwork !== undefined) setNetwork(nextNetwork);
      if (Object.keys(urlUpdate).length > 0) setFilterParams(urlUpdate);
    },
    [setFilterParams, setNetwork]
  );

  const toggleRiskTier = useCallback(
    (tier: EarnRiskTier) => {
      updateFilters({
        risk: filters.risk.includes(tier) ? filters.risk.filter(t => t !== tier) : [...filters.risk, tier]
      });
    },
    [filters.risk, updateFilters]
  );

  /**
   * Resets all four filters — risk included, since the control says "Clear
   * filters". That reaches the shared network filter too: the button clears
   * what the user can see on this page, and the network dropdown is one of them.
   */
  const clearFilters = useCallback(() => {
    setRisk(DEFAULT_FILTERS.risk);
    writeStoredRisk(DEFAULT_FILTERS.risk);
    setNetwork(null);
    setFilterParams({ stablecoin: 'all', product: 'all' });
  }, [setFilterParams, setNetwork]);

  const hasActiveFilters =
    filters.risk.length > 0 ||
    filters.network !== null ||
    filters.stablecoin !== 'all' ||
    filters.product !== 'all';

  const toggleSort = useCallback((column: EarnTableColumn) => {
    setSort(previous =>
      previous.column === column
        ? { column, direction: previous.direction === 'asc' ? 'desc' : 'asc' }
        : { column, direction: defaultDirectionFor(column) }
    );
  }, []);

  return { filters, updateFilters, toggleRiskTier, clearFilters, hasActiveFilters, sort, toggleSort };
}
