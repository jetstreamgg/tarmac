import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider
} from '@tanstack/react-router';
import { Intent } from '@/lib/enums';
import { AppShell } from './AppShell';

// vi.hoisted runs before imports: real Intent values are assigned in beforeEach.
const mocks = vi.hoisted(() => ({
  intent: '' as import('@/lib/enums').Intent,
  effectiveIntent: '' as import('@/lib/enums').Intent
}));

vi.mock('wagmi', async importOriginal => {
  const actual = await importOriginal<typeof import('wagmi')>();
  return { ...actual, useChainId: () => 1 };
});

// Shell chrome and orchestration stubbed: AppShell's responsibility under test
// is where the route content renders, not what the hooks do.
vi.mock('@/modules/layout/components/Layout', () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}));

vi.mock('../hooks/useAppOrchestration', () => ({
  useAppOrchestration: () => ({ intent: mocks.intent })
}));

vi.mock('../hooks/useWidgetItems', () => ({
  useWidgetItems: () => ({ effectiveIntent: mocks.effectiveIntent })
}));

vi.mock('../hooks/useDeeplinkAnalytics', () => ({ useDeeplinkAnalytics: () => {} }));
vi.mock('../hooks/useNetworkChangeToast', () => ({ useNetworkChangeToast: () => {} }));

vi.mock('@/modules/balances/components/BalancesPanes', () => ({
  BalancesPanes: () => <div data-testid="balances-panes-stub" />
}));

beforeEach(() => {
  mocks.intent = Intent.SAVINGS_INTENT;
  mocks.effectiveIntent = Intent.SAVINGS_INTENT;
});

// Memory-router harness: AppShell as the layout route, probe routes mirroring
// a module route (intent) and a destination route (fullWidth).
function renderAppShell(initialPath: string) {
  const rootRoute = createRootRoute({ component: AppShell });
  const routeTree = rootRoute.addChildren([
    createRoute({
      getParentRoute: () => rootRoute,
      path: '/savings',
      component: () => <div data-testid="route-probe" />,
      staticData: { intent: Intent.SAVINGS_INTENT }
    }),
    createRoute({
      getParentRoute: () => rootRoute,
      path: '/earn',
      component: () => <div data-testid="route-probe" />,
      staticData: { fullWidth: true }
    })
  ]);
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [initialPath] })
  });
  render(<RouterProvider router={router as never} />);
}

describe('AppShell pane column', () => {
  it('renders a module route inside the widget-pane column', async () => {
    renderAppShell('/savings');
    const probe = await screen.findByTestId('route-probe');
    expect(probe.closest('[data-testid="widget-pane-column"]')).toBeTruthy();
    expect(probe.closest('main')?.className).toContain('bg-container');
  });

  it('renders a full-width destination route outside the widget-pane column, without the container card', async () => {
    renderAppShell('/earn');
    const probe = await screen.findByTestId('route-probe');
    expect(probe.closest('[data-testid="widget-pane-column"]')).toBeNull();
    expect(probe.closest('main')?.className).not.toContain('bg-container');
  });

  it('falls back to the Balances panes when the module is geo-restricted', async () => {
    mocks.effectiveIntent = Intent.BALANCES_INTENT;
    renderAppShell('/savings');
    expect(await screen.findByTestId('balances-panes-stub')).toBeTruthy();
    expect(screen.queryByTestId('route-probe')).toBeNull();
  });
});
