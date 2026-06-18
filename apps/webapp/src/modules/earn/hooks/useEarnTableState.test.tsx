import { beforeEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useEarnTableState } from './useEarnTableState';

const VALID = {
  networks: ['ethereum', 'base'],
  stablecoins: ['usds', 'usdc'],
  products: ['savings', 'vault']
};
const KEY = 'earnOpportunitiesFilters';

describe('useEarnTableState persistence', () => {
  beforeEach(() => localStorage.clear());

  it('persists only the risk filter, never network/stablecoin/product', () => {
    const { result } = renderHook(() => useEarnTableState(VALID));

    act(() => result.current.updateFilters({ stablecoin: 'usds', network: 'base', product: 'vault' }));
    act(() => result.current.toggleRiskTier('advanced'));

    // localStorage holds only risk...
    expect(JSON.parse(localStorage.getItem(KEY) as string)).toEqual({ risk: ['advanced'] });
    // ...while in-memory state still carries the ephemeral selections.
    expect(result.current.filters).toEqual({
      risk: ['advanced'],
      network: 'base',
      stablecoin: 'usds',
      product: 'vault'
    });
  });

  it('restores only risk from storage; other filters reset to defaults', () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ risk: ['advanced'], network: 'base', stablecoin: 'usdc', product: 'vault' })
    );

    const { result } = renderHook(() => useEarnTableState(VALID));

    expect(result.current.filters).toEqual({
      risk: ['advanced'],
      network: 'all',
      stablecoin: 'all',
      product: 'all'
    });
  });

  it('falls back to defaults when nothing is stored', () => {
    const { result } = renderHook(() => useEarnTableState(VALID));
    expect(result.current.filters).toEqual({ risk: [], network: 'all', stablecoin: 'all', product: 'all' });
  });
});
