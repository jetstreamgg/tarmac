import { useCallback, useState } from 'react';
import type { EarnRiskTier } from '@/hooks';
import type { EarnTableColumn, EarnTableSort } from '@/components/product/EarnTable';
import {
  DEFAULT_SORT,
  defaultDirectionFor,
  sanitizeFilters,
  EarnFilterOptionValues,
  EarnTableFiltersState
} from '../helpers/earnTableState';

const FILTERS_STORAGE_KEY = 'earnOpportunitiesFilters';

// Only the risk filter is a saved preference; network/stablecoin/product are
// ephemeral. Keeps just the risk field, so legacy full-object storage is read
// without resurrecting the other persisted filters.
function readStoredRisk(): unknown {
  try {
    const stored = JSON.parse(localStorage.getItem(FILTERS_STORAGE_KEY) || 'null');
    return stored && typeof stored === 'object' ? { risk: (stored as { risk?: unknown }).risk } : null;
  } catch {
    return null;
  }
}

/**
 * Filter + sort state of the Earn Opportunities table. Only the risk filter is
 * a saved preference (persisted to localStorage, sanitized on load); network,
 * stablecoin, product and sort are ephemeral and reset to their defaults every
 * visit.
 */
export function useEarnTableState(validOptions: EarnFilterOptionValues) {
  const [filters, setFilters] = useState<EarnTableFiltersState>(() =>
    sanitizeFilters(readStoredRisk(), validOptions)
  );
  const [sort, setSort] = useState<EarnTableSort>(DEFAULT_SORT);

  const updateFilters = useCallback((update: Partial<EarnTableFiltersState>) => {
    setFilters(previous => {
      const next = { ...previous, ...update };
      try {
        // Persist only the risk filter; the rest are ephemeral.
        localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify({ risk: next.risk }));
      } catch {
        // ignore storage write failures
      }
      return next;
    });
  }, []);

  const toggleRiskTier = useCallback(
    (tier: EarnRiskTier) => {
      updateFilters({
        risk: filters.risk.includes(tier) ? filters.risk.filter(t => t !== tier) : [...filters.risk, tier]
      });
    },
    [filters.risk, updateFilters]
  );

  const toggleSort = useCallback((column: EarnTableColumn) => {
    setSort(previous =>
      previous.column === column
        ? { column, direction: previous.direction === 'asc' ? 'desc' : 'asc' }
        : { column, direction: defaultDirectionFor(column) }
    );
  }, []);

  return { filters, updateFilters, toggleRiskTier, sort, toggleSort };
}
