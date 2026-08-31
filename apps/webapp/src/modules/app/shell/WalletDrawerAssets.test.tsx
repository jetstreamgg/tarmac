import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider
} from '@tanstack/react-router';
import { I18nWidgetProvider } from '@/widgets/context/I18nWidgetProvider';
import { EARN_OPPORTUNITIES_HASH } from '@/lib/routes';
import type { WalletDrawerAsset } from './useWalletDrawerAssets';

const mocks = vi.hoisted(() => ({
  assets: [] as unknown[],
  isLoading: false
}));

vi.mock('./useWalletDrawerAssets', () => ({
  useWalletDrawerAssets: () => ({ assets: mocks.assets, isLoading: mocks.isLoading, totalUsd: 0 })
}));

vi.mock('@/modules/ui/components/TokenIcon', () => ({ TokenIcon: () => null }));

const { WalletDrawerAssets } = await import('./WalletDrawerAssets');

const asset = (symbol: string, over: Partial<WalletDrawerAsset> = {}): WalletDrawerAsset => ({
  symbol,
  name: symbol,
  amount: 1,
  amountUsd: 1,
  bestRate: 0.05,
  multipleVenues: false,
  canEarn: true,
  ...over
});

function renderAssets() {
  const rootRoute = createRootRoute({ component: () => <Outlet /> });
  const homeRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: WalletDrawerAssets
  });
  const earnRoute = createRoute({ getParentRoute: () => rootRoute, path: '/earn', component: () => null });
  const stakeRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/stake',
    component: () => null
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([homeRoute, earnRoute, stakeRoute]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
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
    <I18nWidgetProvider locale="en">
      <RouterProvider router={router as never} />
    </I18nWidgetProvider>
  );
  return router;
}

beforeEach(() => {
  mocks.assets = [];
  mocks.isLoading = false;
});

describe('WalletDrawerAssets earn actions', () => {
  it('shows the rate badge and CTA for an asset with an available venue', async () => {
    mocks.assets = [asset('USDC', { multipleVenues: true })];
    renderAssets();
    const row = await screen.findByTestId('wallet-drawer-asset-usdc');
    expect(row.textContent).toContain('up to 5.00%');
    expect(screen.getByTestId('wallet-drawer-earn-usdc')).toBeTruthy();
  });

  it('renders a plain balance row when the region leaves the token nowhere to earn', async () => {
    mocks.assets = [asset('USDT', { bestRate: undefined, canEarn: false })];
    renderAssets();
    const row = await screen.findByTestId('wallet-drawer-asset-usdt');
    expect(row.textContent).not.toContain('%');
    expect(screen.queryByTestId('wallet-drawer-earn-usdt')).toBeNull();
  });

  it('deep-links a stablecoin CTA to the filtered Earn table at its anchor', async () => {
    mocks.assets = [asset('USDC')];
    const router = renderAssets();
    fireEvent.click(await screen.findByTestId('wallet-drawer-earn-usdc'));
    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/earn'));
    expect(router.state.location.search).toMatchObject({ token: 'USDC' });
    expect(router.state.location.hash).toBe(EARN_OPPORTUNITIES_HASH);
  });

  it('routes the SKY CTA to Stake instead', async () => {
    mocks.assets = [asset('SKY')];
    const router = renderAssets();
    fireEvent.click(await screen.findByTestId('wallet-drawer-earn-sky'));
    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/stake'));
    expect(router.state.location.hash).toBe('');
  });
});
