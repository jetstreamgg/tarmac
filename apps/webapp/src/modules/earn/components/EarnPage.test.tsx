import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider
} from '@tanstack/react-router';
import { Intent } from '@/lib/enums';
import type { EarnProductRow } from '@/hooks';

// Rows are injected; every product family's own data hook is out of scope here.
const marketplace = vi.hoisted(() => ({ rows: [] as unknown[] }));
vi.mock('@/hooks', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks')>();
  return {
    ...actual,
    useEarnMarketplace: () => ({ rows: marketplace.rows, isLoading: false, totalDepositedUsd: 0 }),
    useUsdsDaiData: () => ({ data: undefined, isLoading: false })
  };
});

// Nothing geo-restricted: the hidden count is about the main table only, and
// the restricted section has its own coverage.
vi.mock('@/modules/geo-config', () => ({
  useGeoConfig: () => ({ isModuleEnabled: () => true, isLoading: false, isRegionVerified: true })
}));

vi.mock('wagmi', async importOriginal => {
  const actual = await importOriginal<typeof import('wagmi')>();
  return { ...actual, useChains: () => [{ id: 1, name: 'Ethereum' }] };
});

// Visual leaves with their own tests; stubbed so this spec is about the
// filter/count wiring rather than icon plumbing.
vi.mock('@/modules/ui/components/TokenIcon', () => ({ TokenIcon: () => null }));
vi.mock('@/modules/ui/components/TokenIconStack', () => ({
  TokenIconStack: () => null,
  IconStack: () => null
}));
vi.mock('./EarnFeaturedCards', () => ({ EarnFeaturedCards: () => null }));
vi.mock('./ProtocolLineageBadge', () => ({ ProtocolLineageBadge: () => null }));
vi.mock('@/utils', async importOriginal => {
  const actual = await importOriginal<typeof import('@/utils')>();
  return { ...actual, getChainIcon: () => null };
});

const { EarnPage } = await import('./EarnPage');

i18n.load('en', {});
i18n.activate('en');

const row = (id: string, over: Partial<EarnProductRow> = {}): EarnProductRow => ({
  id,
  kind: 'savings',
  intent: Intent.SAVINGS_INTENT,
  name: id,
  tokenSymbol: 'sUSDS',
  supplyTokens: ['USDS'],
  risk: 'low',
  riskProfile: 'savings',
  networks: [1],
  detailPath: `/earn/${id}`,
  rate: { value: 0.05, formatted: '5.00%' },
  rate30d: { value: 0.05, formatted: '5.00%' },
  isLoading: false,
  error: null,
  ...over
});

// Two supply tokens and two product kinds, so both dropdowns actually offer
// the values these specs filter by — the hook sanitizes away anything the
// table has no option for, which would silently make a filter a no-op.
const ROWS: EarnProductRow[] = [
  row('usds-a'),
  row('usds-b'),
  row('usdc-only', { supplyTokens: ['USDC'] }),
  row('advanced', { risk: 'advanced', supplyTokens: ['USDC'] }),
  row('vault-usdc', { kind: 'vault', supplyTokens: ['USDC'] })
];

function renderPage(initialPath = '/earn') {
  const rootRoute = createRootRoute({ component: () => <Outlet /> });
  const earnRoute = createRoute({ getParentRoute: () => rootRoute, path: '/earn', component: EarnPage });
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
  render(
    <I18nProvider i18n={i18n}>
      <RouterProvider router={router} />
    </I18nProvider>
  );
  return router;
}

const clearButton = () => screen.queryByTestId('earn-clear-filters');

beforeEach(() => {
  marketplace.rows = ROWS;
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(cleanup);

describe('EarnPage clear-filters control', () => {
  it('stays away while the list is unfiltered', async () => {
    renderPage();
    await screen.findByTestId('earn-opportunities');
    expect(clearButton()).toBeNull();
  });

  it('counts the rows a URL filter is holding back', async () => {
    // 5 rows, 3 supply USDC -> 2 hidden.
    renderPage('/earn?token=usdc');
    await screen.findByTestId('earn-opportunities');
    expect(clearButton()?.textContent).toContain('(2)');
  });

  it('counts every active filter together, not just the last one', async () => {
    // USDC narrows to 3, savings drops the vault -> 2 left, 3 hidden.
    renderPage('/earn?token=usdc&product=savings');
    await screen.findByTestId('earn-opportunities');
    expect(clearButton()?.textContent).toContain('(3)');
  });

  it('stays away when a filter is applied but hides nothing', async () => {
    // Every row is on mainnet, so this filter is a no-op — there is nothing to
    // escape from, and the control must not offer a "(0)".
    renderPage('/earn?chain=ethereum');
    await screen.findByTestId('earn-opportunities');
    expect(clearButton()).toBeNull();
  });

  it('appears when the filters hide the whole table', async () => {
    // The only vault supplies USDC, so USDS + vault matches nothing.
    renderPage('/earn?token=usds&product=vault');
    await screen.findByTestId('earn-opportunities');
    expect(clearButton()?.textContent).toContain('(5)');
  });

  it('appears for the risk filter, which lives in storage rather than the URL', async () => {
    localStorage.setItem('earnOpportunitiesFilters', JSON.stringify({ risk: ['advanced'] }));
    renderPage();
    await screen.findByTestId('earn-opportunities');
    expect(clearButton()?.textContent).toContain('(4)');
  });

  it('clears the URL filters and the stored risk together', async () => {
    localStorage.setItem('earnOpportunitiesFilters', JSON.stringify({ risk: ['advanced'] }));
    const router = renderPage('/earn?token=usdc');
    await screen.findByTestId('earn-opportunities');

    fireEvent.click(clearButton() as HTMLElement);

    await vi.waitFor(() => expect(clearButton()).toBeNull());
    expect(router.state.location.searchStr).toBe('');
    expect(JSON.parse(localStorage.getItem('earnOpportunitiesFilters') as string)).toEqual({ risk: [] });
  });
});
