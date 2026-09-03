import { beforeEach, describe, expect, it, vi } from 'vitest';
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
import { resetNetworkFilterForTests } from '@/lib/networkFilter';
import { useEarnTableState } from './useEarnTableState';

// The network filter is the app-wide one now (lib/networkFilter), so the hook
// reads wagmi for the chain family it clamps against. Mainnet keeps the family
// at the five production chains, which is what makes 8453 a valid selection.
vi.mock('wagmi', async io => ({
  ...(await io<typeof import('wagmi')>()),
  useChainId: () => 1
}));

const BASE = 8453;
const VALID = {
  stablecoins: ['usds', 'usdc'],
  products: ['savings', 'vault']
};
const KEY = 'earnOpportunitiesFilters';

type State = ReturnType<typeof useEarnTableState>;

/**
 * Memory-router harness: the two URL-driven filters read and write the search
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
  const productRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/earn/savings',
    component: () => null
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([earnRoute, productRoute]),
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
  return { state: captured, searchOf, router };
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  // The network filter store is module-level, so clearing storage alone leaves
  // the previous test's value in memory.
  resetNetworkFilterForTests();
});

describe('useEarnTableState risk persistence', () => {
  it('keeps risk in its own key, stablecoin/product in the URL, network in the shared store', async () => {
    const { state, searchOf } = await renderState();

    act(() => state.current.updateFilters({ stablecoin: 'usds', network: BASE, product: 'vault' }));
    act(() => state.current.toggleRiskTier('advanced'));

    // This hook's localStorage key holds only risk...
    expect(JSON.parse(localStorage.getItem(KEY) as string)).toEqual({ risk: ['advanced'] });
    // ...the two table-local filters went to the URL, and network went to the
    // app-wide store rather than either.
    await waitFor(() => expect(searchOf()).toEqual({ token: 'usds', product: 'vault' }));
    expect(state.current.filters).toEqual({
      risk: ['advanced'],
      network: BASE,
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
      network: null,
      stablecoin: 'all',
      product: 'all'
    });
  });

  it('falls back to defaults when nothing is stored', async () => {
    const { state } = await renderState();
    expect(state.current.filters).toEqual({ risk: [], network: null, stablecoin: 'all', product: 'all' });
  });

  it('survives a remount — the network filter is a global preference', async () => {
    const first = await renderState();
    act(() => first.state.current.updateFilters({ network: BASE }));

    const { state } = await renderState('/earn');

    expect(state.current.filters.network).toBe(BASE);
  });
});

describe('useEarnTableState URL filters', () => {
  it('reads the two table-local filters off the search string', async () => {
    const { state } = await renderState('/earn?token=usdc&product=savings');
    expect(state.current.filters).toMatchObject({
      stablecoin: 'usdc',
      product: 'savings'
    });
  });

  it('ignores a legacy ?chain= param — the network filter is no longer URL-driven', async () => {
    const { state } = await renderState('/earn?chain=base');
    expect(state.current.filters.network).toBeNull();
  });

  it('accepts a deep link that spells the token as it is displayed', async () => {
    const { state } = await renderState('/earn?token=USDS');
    expect(state.current.filters.stablecoin).toBe('usds');
  });

  it('ignores values the table offers no option for, without rewriting the URL', async () => {
    const { state, searchOf } = await renderState('/earn?product=bogus');
    expect(state.current.filters).toMatchObject({ network: null, product: 'all' });
    expect(state.current.hasActiveFilters).toBe(false);
    // Left in place: the option sets arrive asynchronously, so a value that is
    // not valid *yet* must not be scrubbed.
    expect(searchOf()).toEqual({ product: 'bogus' });
  });

  it('drops a param rather than writing "all" when a filter is reset', async () => {
    const { state, searchOf } = await renderState('/earn?token=usdc&product=vault');

    act(() => state.current.updateFilters({ product: 'all' }));

    await waitFor(() => expect(searchOf()).toEqual({ token: 'usdc' }));
  });
});

describe('useEarnTableState clearFilters', () => {
  it('resets all four filters, risk and the shared network filter included', async () => {
    localStorage.setItem(KEY, JSON.stringify({ risk: ['low'] }));
    const { state, searchOf } = await renderState('/earn?token=usdc&product=vault');
    act(() => state.current.updateFilters({ network: BASE }));
    expect(state.current.hasActiveFilters).toBe(true);

    act(() => state.current.clearFilters());

    await waitFor(() => expect(searchOf()).toEqual({}));
    expect(state.current.filters).toEqual({ risk: [], network: null, stablecoin: 'all', product: 'all' });
    expect(JSON.parse(localStorage.getItem(KEY) as string)).toEqual({ risk: [] });
    expect(state.current.hasActiveFilters).toBe(false);
  });

  it('flags active filters from the shared network filter alone', async () => {
    const { state } = await renderState();
    act(() => state.current.updateFilters({ network: BASE }));
    expect(state.current.hasActiveFilters).toBe(true);
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

  it('holds the memory while the marketplace is being left for a product page', async () => {
    // The hook reads the router's global location, so it re-renders with the
    // product page's (filter-less) search before it unmounts. That render must
    // not record anything, or the back link would land on an unfiltered /earn.
    const { router } = await renderState('/earn?token=usdc');
    await waitFor(() => expect(recallEarnFilterSearch()).toEqual({ token: 'usdc' }));

    await act(async () => {
      await router.navigate({ to: '/earn/savings' });
    });

    expect(recallEarnFilterSearch()).toEqual({ token: 'usdc' });
  });
});
