import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider
} from '@tanstack/react-router';
import { I18nWidgetProvider } from '@/widgets/context/I18nWidgetProvider';
import { ModuleCardVariant } from './ModulesBalances';
import { SavingsBalanceCard } from './SavingsBalanceCard';

vi.mock('wagmi', async importOriginal => {
  const actual = await importOriginal<typeof import('wagmi')>();
  return { ...actual, useChainId: () => 1 };
});

vi.mock('@/hooks', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks')>();
  return {
    ...actual,
    useOverallSkyData: () => ({
      data: { skySavingsRatecRate: '0.045' },
      isLoading: false
    }),
    usePrices: () => ({ data: { USDS: { price: '1' } }, isLoading: false })
  };
});

function renderCard() {
  const rootRoute = createRootRoute({
    component: () => (
      <SavingsBalanceCard
        urlMap={{ 1: '/savings' }}
        savingsBalances={[{ chainId: 1, balance: 100n * 10n ** 18n }]}
        loading={false}
        variant={ModuleCardVariant.alt}
      />
    )
  });
  const stubRoute = (path: string) =>
    createRoute({ getParentRoute: () => rootRoute, path, component: () => null });
  const router = createRouter({
    routeTree: rootRoute.addChildren([stubRoute('/'), stubRoute('/savings')]),
    history: createMemoryHistory({ initialEntries: ['/'] })
  });

  render(
    <I18nWidgetProvider locale="en">
      <RouterProvider router={router as never} />
    </I18nWidgetProvider>
  );
}

describe('SavingsBalanceCard (alt variant)', () => {
  it('surfaces the savings rate as an APY badge and links Start earning to the module', async () => {
    renderCard();

    const badge = await screen.findByTestId('asset-apy-badge');
    expect(badge.textContent).toContain('4.50%');
    expect(screen.getByTestId('start-earning-cta').getAttribute('href')).toBe('/savings');
  });
});
