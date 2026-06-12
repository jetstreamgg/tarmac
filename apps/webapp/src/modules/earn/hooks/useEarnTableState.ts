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

function readStoredFilters(): unknown {
  try {
    return JSON.parse(localStorage.getItem(FILTERS_STORAGE_KEY) || 'null');
  } catch {
    return null;
  }
}

/**
 * Filter + sort state of the Earn Opportunities table. Filters are personal
 * preferences: persisted to localStorage and sanitized against the offered
 * options on load. Sort is ephemeral and resets to the default every visit.
 */
export function useEarnTableState(validOptions: EarnFilterOptionValues) {
  const [filters, setFilters] = useState<EarnTableFiltersState>(() =>
    sanitizeFilters(readStoredFilters(), validOptions)
  );
  const [sort, setSort] = useState<EarnTableSort>(DEFAULT_SORT);

  const updateFilters = useCallback((update: Partial<EarnTableFiltersState>) => {
    setFilters(previous => {
      const next = { ...previous, ...update };
      try {
        localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(next));
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
