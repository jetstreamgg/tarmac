import { describe, expect, it } from 'vitest';
import type { EarnProductRow } from '@/hooks';
import {
  DEFAULT_FILTERS,
  DEFAULT_SORT,
  defaultDirectionFor,
  filterEarnRows,
  sanitizeFilters,
  sortEarnRows
} from './earnTableState';

const row = (overrides: Partial<EarnProductRow>): EarnProductRow =>
  ({
    id: 'savings',
    kind: 'savings',
    name: 'Sky Savings Rate',
    tokenSymbol: 'sUSDS',
    supplyTokens: ['USDS'],
    risk: 'moderate',
    networks: [1],
    detailPath: '/earn/savings',
    rate: { formatted: '—' },
    isLoading: false,
    error: null,
    ...overrides
  }) as EarnProductRow;

const ROWS: EarnProductRow[] = [
  row({ id: 'stusds', kind: 'stusds', name: 'stUSDS', tokenSymbol: 'stUSDS', risk: 'advanced' }),
  row({
    id: 'savings',
    networks: [1, 8453],
    rate: { value: 0.036, formatted: '3.60%' },
    tvl: { totalUsd: 100 }
  }),
  row({
    id: 'vault-morpho-0xa',
    kind: 'vault',
    name: 'USDT Savings',
    tokenSymbol: 'USDT',
    supplyTokens: ['USDT'],
    rate: { value: 0.024, formatted: '2.40%' },
    tvl: { totalUsd: 300 }
  }),
  row({ id: 'rewards-cle', kind: 'rewards', name: 'Chronicle Points', tokenSymbol: 'USDS' })
];

describe('sanitizeFilters', () => {
  const valid = { stablecoins: ['usds', 'usdt'], products: ['savings'] };

  it('returns defaults for malformed input', () => {
    expect(sanitizeFilters(null, valid)).toEqual(DEFAULT_FILTERS);
    expect(sanitizeFilters('junk', valid)).toEqual(DEFAULT_FILTERS);
  });

  it('drops values the table no longer offers', () => {
    expect(
      sanitizeFilters(
        { risk: ['advanced', 'bogus'], network: 8453, stablecoin: 'usdt', product: 'retired' },
        valid
      )
    ).toEqual({ risk: ['advanced'], network: 8453, stablecoin: 'usdt', product: 'all' });
  });

  it('reads a non-numeric network as "All networks"', () => {
    // Legacy storage held the chain slug; the filter is a chain id now.
    expect(sanitizeFilters({ network: 'ethereum' }, valid).network).toBeNull();
  });
});

describe('filterEarnRows', () => {
  it('shows every tier when no risk tier is selected', () => {
    expect(filterEarnRows(ROWS, DEFAULT_FILTERS)).toHaveLength(ROWS.length);
  });

  it('filters by selected risk tiers', () => {
    const visible = filterEarnRows(ROWS, { ...DEFAULT_FILTERS, risk: ['advanced'] });
    expect(visible.map(r => r.id)).toEqual(['stusds']);
  });

  it('filters by network membership', () => {
    const visible = filterEarnRows(ROWS, { ...DEFAULT_FILTERS, network: 8453 });
    expect(visible.map(r => r.id)).toEqual(['savings']);
  });

  it('filters by supply token and product kind', () => {
    expect(filterEarnRows(ROWS, { ...DEFAULT_FILTERS, stablecoin: 'usdt' }).map(r => r.id)).toEqual([
      'vault-morpho-0xa'
    ]);
    expect(filterEarnRows(ROWS, { ...DEFAULT_FILTERS, product: 'rewards' }).map(r => r.id)).toEqual([
      'rewards-cle'
    ]);
  });
});

describe('sortEarnRows', () => {
  it('defaults to risk ascending with registry order preserved within a tier', () => {
    const sorted = sortEarnRows(ROWS, DEFAULT_SORT);
    expect(sorted.map(r => r.id)).toEqual(['savings', 'vault-morpho-0xa', 'rewards-cle', 'stusds']);
  });

  it('sorts rows without a value last in both directions', () => {
    const desc = sortEarnRows(ROWS, { column: 'rate', direction: 'desc' });
    expect(desc.map(r => r.id)).toEqual(['savings', 'vault-morpho-0xa', 'stusds', 'rewards-cle']);
    const asc = sortEarnRows(ROWS, { column: 'rate', direction: 'asc' });
    expect(asc.map(r => r.id)).toEqual(['vault-morpho-0xa', 'savings', 'stusds', 'rewards-cle']);
  });

  it('does not mutate the input', () => {
    const input = [...ROWS];
    sortEarnRows(input, { column: 'tvl', direction: 'desc' });
    expect(input).toEqual(ROWS);
  });
});

describe('defaultDirectionFor', () => {
  it('starts numeric columns descending and the rest ascending', () => {
    expect(defaultDirectionFor('tvl')).toBe('desc');
    expect(defaultDirectionFor('rate')).toBe('desc');
    expect(defaultDirectionFor('token')).toBe('asc');
    expect(defaultDirectionFor('risk')).toBe('asc');
  });
});
