import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen, cleanup, fireEvent, act, waitFor } from '@testing-library/react';
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
import { EARN_OPPORTUNITIES_HASH } from '@/lib/routes';
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

// Matured PT drives the "Requires action" section; swappable per test.
const matured = vi.hoisted(() => ({
  current: { maturedPositions: [] as { market: Record<string, unknown>; ptBalance: bigint }[] }
}));
vi.mock('@/modules/pendle/hooks/usePendleMaturedPositions', () => ({
  usePendleMaturedPositions: () => matured.current,
  usePendleMaturedNetworkSwitch: () => undefined
}));

vi.mock('@/widgets', async importOriginal => {
  const actual = await importOriginal<typeof import('@/widgets')>();
  return { ...actual, usePendleUsdValue: () => (_symbol: string, amount: number) => amount };
});

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
    // The app router's setting; the deep-link specs below exercise its hash
    // scrolling against the heading's anchor.
    scrollRestoration: true,
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

describe('EarnPage deep-link anchor scroll', () => {
  const scrollSpy = vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => {});
  const scrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});

  beforeEach(() => {
    scrollSpy.mockClear();
    scrollToSpy.mockClear();
  });

  it('lands on the opportunities heading when the deep link carries the anchor', async () => {
    renderPage(`/earn?token=usdc#${EARN_OPPORTUNITIES_HASH}`);
    await screen.findByTestId('earn-opportunities');
    await vi.waitFor(() => expect(scrollSpy).toHaveBeenCalled());
    // Every scroll (the router's hash handling and the cold-load catch-up
    // both fire here — the mock never moves scrollY) targets the heading.
    for (const target of scrollSpy.mock.contexts) {
      expect((target as HTMLElement).id).toBe(EARN_OPPORTUNITIES_HASH);
    }
  });

  it('leaves a ?token= visit without the anchor at the top (back links, redirects)', async () => {
    renderPage('/earn?token=usdc');
    await screen.findByTestId('earn-opportunities');
    expect(scrollSpy).not.toHaveBeenCalled();
  });

  it('drops the anchor with the first filter edit, so clearing does not re-scroll', async () => {
    const router = renderPage(`/earn?token=usdc#${EARN_OPPORTUNITIES_HASH}`);
    await screen.findByTestId('earn-opportunities');
    await vi.waitFor(() => expect(scrollSpy).toHaveBeenCalled());
    const arrivalScrolls = scrollSpy.mock.calls.length;

    fireEvent.click(clearButton() as HTMLElement);

    await vi.waitFor(() => expect(clearButton()).toBeNull());
    expect(router.state.location.hash).toBe('');
    expect(scrollSpy).toHaveBeenCalledTimes(arrivalScrolls);
    // The filter write passes resetScroll: false, so the router's usual
    // scroll-to-top on the replace never runs — the viewport stays at the
    // table.
    expect(scrollToSpy).not.toHaveBeenCalled();
  });

  it('scrolls again when a new deep link pushes onto an already-open /earn', async () => {
    const router = renderPage(`/earn?token=usdc#${EARN_OPPORTUNITIES_HASH}`);
    await screen.findByTestId('earn-opportunities');
    await vi.waitFor(() => expect(scrollSpy).toHaveBeenCalled());
    const arrivalScrolls = scrollSpy.mock.calls.length;

    // The wallet drawer while already on /earn: a push, unlike the filter
    // bar's in-place replaces.
    await act(() =>
      router.navigate({ to: '/earn', search: { token: 'USDS' }, hash: EARN_OPPORTUNITIES_HASH })
    );

    await vi.waitFor(() => expect(scrollSpy.mock.calls.length).toBeGreaterThan(arrivalScrolls));
  });
});

describe('EarnPage requires-action section', () => {
  const MATURED = {
    maturedPositions: [
      {
        market: {
          name: 'Fixed Yield',
          slug: 'pt-susds',
          marketAddress: '0x9C56' as `0x${string}`,
          underlyingSymbol: 'sUSDS',
          underlyingDecimals: 18,
          expiry: 1700000000,
          usdsEquivalence: 'pegged'
        },
        ptBalance: 1200n * 10n ** 18n
      }
    ]
  };

  beforeEach(() => {
    matured.current = { maturedPositions: [] };
  });

  it('stays hidden while the user holds nothing matured', async () => {
    renderPage();
    await screen.findByText('Earn Opportunities');
    expect(screen.queryByTestId('earn-requires-action')).toBeNull();
  });

  it('lists a matured position with dashed market cells and the held value', async () => {
    matured.current = MATURED as typeof matured.current;
    renderPage();
    await screen.findByText('Requires action');

    const row = screen.getByTestId('earn-requires-action-row-matured-0x9c56');
    expect(row.textContent).toContain('Pendle sUSDS');
    expect(row.textContent).toContain('Matured');
    // 1,200 PT at par → $1.2k compact, like the opportunities table's positions.
    expect(row.textContent).toContain('$1.2k');
    // No live market data: rate/30d/tvl and the risk cell are dashes.
    expect(row.textContent).not.toContain('%');
  });

  it('routes a row click to the matured market detail page, where the claim card lives', async () => {
    matured.current = MATURED as typeof matured.current;
    const router = renderPage();
    await screen.findByText('Requires action');

    fireEvent.click(screen.getByTestId('earn-requires-action-row-matured-0x9c56'));
    await waitFor(() => expect(router.state.location.pathname).toBe('/earn/fixed/pt-susds'));
  });
});
