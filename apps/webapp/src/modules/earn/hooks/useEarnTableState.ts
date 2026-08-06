import { useCallback, useEffect, useMemo, useState } from 'react';
import type { EarnRiskTier } from '@/hooks';
import type { EarnTableColumn, EarnTableSort } from '@/components/product/EarnTable';
import { QueryParams } from '@/lib/constants';
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

// Only the risk filter is a saved preference; network/stablecoin/product live
// in the URL. Keeps just the risk field, so legacy full-object storage is read
// without resurrecting the other persisted filters.
function readStoredRisk(): EarnRiskTier[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(FILTERS_STORAGE_KEY) || 'null');
    if (typeof stored !== 'object' || stored === null) return DEFAULT_FILTERS.risk;
    // sanitizeFilters validates the tiers; the option sets it also checks are
    // irrelevant to risk, so any empty set will do.
    return sanitizeFilters(stored, { networks: [], stablecoins: [], products: [] }).risk;
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

/** URL param backing each of the three query-driven filters. */
const PARAM_BY_FILTER = {
  network: QueryParams.Chain,
  stablecoin: QueryParams.Token,
  product: QueryParams.Product
} as const;

type UrlFilterKey = keyof typeof PARAM_BY_FILTER;

/**
 * Filter + sort state of the Earn Opportunities table.
 *
 * Network, stablecoin and product live in the search string (APP-457): that is
 * what survives a back-navigation from a product page, and what the navbar's
 * Earn link clears by virtue of `retainOnNavigate` dropping every param but
 * `network`. Risk stays a saved preference in localStorage, and sort is
 * ephemeral — it resets to its default on every visit.
 */
export function useEarnTableState(validOptions: EarnFilterOptionValues) {
  const [searchParams, setSearchParams] = useAppSearchParams();
  const [risk, setRisk] = useState<EarnRiskTier[]>(readStoredRisk);
  const [sort, setSort] = useState<EarnTableSort>(DEFAULT_SORT);

  const { networks, stablecoins, products } = validOptions;

  // Values the URL is asking for. Sanitizing on read (rather than rewriting the
  // URL) is deliberate: the option sets arrive asynchronously, so a deep link
  // would otherwise be scrubbed before its value ever became valid.
  const filters = useMemo<EarnTableFiltersState>(
    () =>
      sanitizeFilters(
        {
          risk,
          network: searchParams.get(PARAM_BY_FILTER.network),
          // Callers deep-link the symbol as it's displayed (/earn?token=USDS);
          // filter values are the lowercase option values.
          stablecoin: searchParams.get(PARAM_BY_FILTER.stablecoin)?.toLowerCase(),
          product: searchParams.get(PARAM_BY_FILTER.product)
        },
        { networks, stablecoins, products }
      ),
    [risk, searchParams, networks, stablecoins, products]
  );

  // What "Back to products" restores. Written on every change, empty object
  // included — landing on a clean /earn is what wipes a stale memory.
  useEffect(() => {
    rememberEarnFilterSearch(Object.fromEntries(searchParams));
  }, [searchParams]);

  // `replace` keeps filter fiddling out of the history stack: back still leaves
  // /earn in one press, while the /earn entry itself carries the latest filters.
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
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const updateFilters = useCallback(
    (update: Partial<EarnTableFiltersState>) => {
      const { risk: nextRisk, ...urlUpdate } = update;
      if (nextRisk) {
        setRisk(nextRisk);
        writeStoredRisk(nextRisk);
      }
      if (Object.keys(urlUpdate).length > 0) setFilterParams(urlUpdate);
    },
    [setFilterParams]
  );

  const toggleRiskTier = useCallback(
    (tier: EarnRiskTier) => {
      updateFilters({
        risk: filters.risk.includes(tier) ? filters.risk.filter(t => t !== tier) : [...filters.risk, tier]
      });
    },
    [filters.risk, updateFilters]
  );

  /** Resets all four filters — risk included, since the control says "Clear filters". */
  const clearFilters = useCallback(() => {
    setRisk(DEFAULT_FILTERS.risk);
    writeStoredRisk(DEFAULT_FILTERS.risk);
    setFilterParams({ network: 'all', stablecoin: 'all', product: 'all' });
  }, [setFilterParams]);

  const hasActiveFilters =
    filters.risk.length > 0 ||
    filters.network !== 'all' ||
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
