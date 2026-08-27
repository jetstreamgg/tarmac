import type { EarnProductRow, EarnRiskTier } from '@/hooks';
import type { NetworkFilter } from '@/lib/networkFilter';
import type { EarnTableColumn, EarnTableSort } from '@/components/product/EarnTable';

export const RISK_ORDER: Record<EarnRiskTier, number> = { low: 0, moderate: 1, advanced: 2 };

const RISK_TIERS = Object.keys(RISK_ORDER) as EarnRiskTier[];

export type EarnTableFiltersState = {
  /** Selected tiers; empty = no risk filtering. */
  risk: EarnRiskTier[];
  /**
   * The app-wide network filter (lib/networkFilter): a chain id, or `null` for
   * "All networks". Unlike the two below it is not local to this table — it is
   * the same value the Portfolio header, the transactions toolbar and the
   * wallet drawer read.
   */
  network: NetworkFilter;
  /** 'all' or a lowercase supply-token symbol. */
  stablecoin: string;
  /** 'all' or an EarnProductKind. */
  product: string;
};

export type EarnFilterOptionValues = {
  stablecoins: string[];
  products: string[];
};

export const DEFAULT_FILTERS: EarnTableFiltersState = {
  risk: [],
  network: null,
  stablecoin: 'all',
  product: 'all'
};

// Sort resets to this default every visit (deliberate deviation from the C2
// AC's URL-controlled state — only the risk filter persists locally; network,
// stablecoin, product and sort are ephemeral).
export const DEFAULT_SORT: EarnTableSort = { column: 'risk', direction: 'asc' };

/** Direction a column starts with when first selected: sizes/rates biggest-first. */
export function defaultDirectionFor(column: EarnTableColumn): 'asc' | 'desc' {
  return column === 'rate' || column === 'rate30d' || column === 'tvl' || column === 'position'
    ? 'desc'
    : 'asc';
}

/**
 * Validates persisted filter state against the option sets the table actually
 * offers, so stale localStorage (renamed product kinds…) can never produce an
 * inexplicably empty table. Network is exempt: it comes from the shared store,
 * which clamps against the connected chain family itself.
 */
export function sanitizeFilters(raw: unknown, valid: EarnFilterOptionValues): EarnTableFiltersState {
  if (typeof raw !== 'object' || raw === null) return DEFAULT_FILTERS;
  const candidate = raw as Partial<Record<keyof EarnTableFiltersState, unknown>>;
  const risk = Array.isArray(candidate.risk)
    ? (candidate.risk.filter(tier => RISK_TIERS.includes(tier as EarnRiskTier)) as EarnRiskTier[])
    : DEFAULT_FILTERS.risk;
  const pick = (value: unknown, options: string[]): string =>
    typeof value === 'string' && options.includes(value) ? value : 'all';
  return {
    risk,
    network: typeof candidate.network === 'number' ? candidate.network : null,
    stablecoin: pick(candidate.stablecoin, valid.stablecoins),
    product: pick(candidate.product, valid.products)
  };
}

/**
 * The row fields the filters read. Structural, so the "Requires action"
 * section's matured entries — which are not full marketplace rows — run
 * through the same pass as everything else on the page.
 */
type EarnFilterableRow = Pick<EarnProductRow, 'risk' | 'networks' | 'supplyTokens' | 'kind'>;

export function filterEarnRows<T extends EarnFilterableRow>(rows: T[], filters: EarnTableFiltersState): T[] {
  return rows.filter(row => {
    if (filters.risk.length > 0 && !filters.risk.includes(row.risk)) return false;
    if (filters.network !== null && !row.networks.includes(filters.network)) return false;
    if (
      filters.stablecoin !== 'all' &&
      !row.supplyTokens.some(symbol => symbol.toLowerCase() === filters.stablecoin)
    ) {
      return false;
    }
    if (filters.product !== 'all' && row.kind !== filters.product) return false;
    return true;
  });
}

function sortValue(row: EarnProductRow, column: EarnTableColumn): number | string | undefined {
  switch (column) {
    case 'token':
      return row.name.toLowerCase();
    case 'network':
      return row.networks.length;
    case 'risk':
      return RISK_ORDER[row.risk];
    case 'rate':
      return row.rate.value;
    case 'rate30d':
      return row.rate30d?.value;
    case 'tvl':
      return row.tvl?.totalUsd;
    case 'position':
      return row.position?.totalUsd;
  }
}

/**
 * Stable sort (registry order breaks ties); rows without a value for the
 * column sort last in either direction.
 */
export function sortEarnRows(rows: EarnProductRow[], sort: EarnTableSort): EarnProductRow[] {
  const sign = sort.direction === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const aValue = sortValue(a, sort.column);
    const bValue = sortValue(b, sort.column);
    if (aValue === undefined && bValue === undefined) return 0;
    if (aValue === undefined) return 1;
    if (bValue === undefined) return -1;
    if (aValue < bValue) return -sign;
    if (aValue > bValue) return sign;
    return 0;
  });
}
