import { beforeEach, describe, expect, it } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider
} from '@tanstack/react-router';
import { recallEarnFilterSearch } from '@/lib/earnFilterMemory';
import { useEarnTableState } from './useEarnTableState';

const VALID = {
  networks: ['ethereum', 'base'],
  stablecoins: ['usds', 'usdc'],
  products: ['savings', 'vault']
};
const KEY = 'earnOpportunitiesFilters';

type State = ReturnType<typeof useEarnTableState>;

/**
 * Memory-router harness: the three URL-driven filters read and write the search
 * string, so the hook needs a real router underneath. `parseSearch` /
 * `stringifySearch` mirror the app's (plain URLSearchParams semantics, not
 * TanStack's JSON encoding) so the params round-trip byte-for-byte.
 */
async function renderState(initialPath = '/earn') {
  const captured = { current: undefined as unknown as State };
  function Probe() {
    captured.current = useEarnTableState(VALID);
    return <div data-testid="probe" />;
  }
  const rootRoute = createRootRoute({
    component: () => (
      <>
        <Probe />
        <Outlet />
      </>
    )
  });
  const earnRoute = createRoute({ getParentRoute: () => rootRoute, path: '/earn', component: () => null });
  const router = createRouter({
    routeTree: rootRoute.addChildren([earnRoute]),
    history: createMemoryHistory({ initialEntries: [initialPath] }),
    parseSearch: searchStr => Object.fromEntries(new URLSearchParams(searchStr)),
    stringifySearch: search => {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(search)) {
        if (value !== undefined && value !== null) params.set(key, String(value));
      }
      const str = params.toString();
      return str ? `?${str}` : '';
    }
  });
  render(<RouterProvider router={router} />);
  // The router mounts asynchronously, so nothing has called the hook yet.
  await screen.findByTestId('probe');
  const searchOf = () => Object.fromEntries(new URLSearchParams(router.state.location.searchStr));
  return { state: captured, searchOf };
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe('useEarnTableState risk persistence', () => {
  it('persists only the risk filter, never network/stablecoin/product', async () => {
    const { state, searchOf } = await renderState();

    act(() => state.current.updateFilters({ stablecoin: 'usds', network: 'base', product: 'vault' }));
    act(() => state.current.toggleRiskTier('advanced'));

    // localStorage holds only risk...
    expect(JSON.parse(localStorage.getItem(KEY) as string)).toEqual({ risk: ['advanced'] });
    // ...the other three went to the URL instead.
    await waitFor(() => expect(searchOf()).toEqual({ chain: 'base', token: 'usds', product: 'vault' }));
    expect(state.current.filters).toEqual({
      risk: ['advanced'],
      network: 'base',
      stablecoin: 'usds',
      product: 'vault'
    });
  });

  it('restores risk from storage and drops the legacy persisted filters', async () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ risk: ['advanced'], network: 'base', stablecoin: 'usdc', product: 'vault' })
    );

    const { state } = await renderState();

    expect(state.current.filters).toEqual({
      risk: ['advanced'],
      network: 'all',
      stablecoin: 'all',
      product: 'all'
    });
  });

  it('falls back to defaults when nothing is stored', async () => {
    const { state } = await renderState();
    expect(state.current.filters).toEqual({ risk: [], network: 'all', stablecoin: 'all', product: 'all' });
  });
});

describe('useEarnTableState URL filters', () => {
  it('reads the three filters off the search string', async () => {
    const { state } = await renderState('/earn?chain=ethereum&token=usdc&product=savings');
    expect(state.current.filters).toMatchObject({
      network: 'ethereum',
      stablecoin: 'usdc',
      product: 'savings'
    });
  });

  it('accepts a deep link that spells the token as it is displayed', async () => {
    const { state } = await renderState('/earn?token=USDS');
    expect(state.current.filters.stablecoin).toBe('usds');
  });

  it('ignores values the table offers no option for, without rewriting the URL', async () => {
    const { state, searchOf } = await renderState('/earn?chain=solana&product=bogus');
    expect(state.current.filters).toMatchObject({ network: 'all', product: 'all' });
    expect(state.current.hasActiveFilters).toBe(false);
    // Left in place: the option sets arrive asynchronously, so a value that is
    // not valid *yet* must not be scrubbed.
    expect(searchOf()).toEqual({ chain: 'solana', product: 'bogus' });
  });

  it('drops a param rather than writing "all" when a filter is reset', async () => {
    const { state, searchOf } = await renderState('/earn?chain=base&token=usdc');

    act(() => state.current.updateFilters({ network: 'all' }));

    await waitFor(() => expect(searchOf()).toEqual({ token: 'usdc' }));
  });
});

describe('useEarnTableState clearFilters', () => {
  it('resets all four filters, risk included', async () => {
    localStorage.setItem(KEY, JSON.stringify({ risk: ['low'] }));
    const { state, searchOf } = await renderState('/earn?chain=base&token=usdc&product=vault');
    expect(state.current.hasActiveFilters).toBe(true);

    act(() => state.current.clearFilters());

    await waitFor(() => expect(searchOf()).toEqual({}));
    expect(state.current.filters).toEqual({ risk: [], network: 'all', stablecoin: 'all', product: 'all' });
    expect(JSON.parse(localStorage.getItem(KEY) as string)).toEqual({ risk: [] });
    expect(state.current.hasActiveFilters).toBe(false);
  });

  it('flags active filters from risk alone', async () => {
    localStorage.setItem(KEY, JSON.stringify({ risk: ['low'] }));
    const { state } = await renderState();
    expect(state.current.hasActiveFilters).toBe(true);
  });
});

describe('useEarnTableState back-link memory', () => {
  it('records the URL filters so "Back to products" can restore them', async () => {
    const { state } = await renderState();

    act(() => state.current.updateFilters({ stablecoin: 'usdc', product: 'savings' }));

    await waitFor(() => expect(recallEarnFilterSearch()).toEqual({ token: 'usdc', product: 'savings' }));
  });

  it('wipes the memory when the marketplace is landed on unfiltered', async () => {
    sessionStorage.setItem('earnFilterSearch', JSON.stringify({ token: 'usdc' }));

    await renderState();

    await waitFor(() => expect(recallEarnFilterSearch()).toEqual({}));
  });
});
