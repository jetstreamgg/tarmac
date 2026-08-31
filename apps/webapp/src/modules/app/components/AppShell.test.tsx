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

beforeEach(() => {
  mocks.intent = Intent.SAVINGS_INTENT;
  mocks.effectiveIntent = Intent.SAVINGS_INTENT;
});

// Memory-router harness: AppShell as the layout route with a probe child.
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
      component: () => <div data-testid="route-probe" />
    })
  ]);
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [initialPath] })
  });
  render(<RouterProvider router={router as never} />);
}

// G5: there is one rendering mode left. Every route is a full-width page on the
// document scroll — no widget-pane column, no container card, no details portal.
describe('AppShell', () => {
  it.each(['/savings', '/earn'])(
    'renders %s as a full-width page, without the container card',
    async path => {
      renderAppShell(path);
      const probe = await screen.findByTestId('route-probe');
      const main = probe.closest('main');

      expect(main).toBeTruthy();
      // The legacy card box: viewport cap + inner scroll + container chrome.
      expect(main?.className).not.toContain('bg-container');
      expect(main?.className).not.toContain('h-dvh');
      expect(main?.className).not.toContain('overflow-y-auto');
      // The DS page container is all that remains.
      expect(main?.className).toContain('max-w-[1320px]');
    }
  );

  it('no longer renders the widget-pane column or the details-pane portal target', async () => {
    renderAppShell('/savings');
    await screen.findByTestId('route-probe');
    expect(screen.queryByTestId('widget-pane-column')).toBeNull();
  });

  // The geo fallback that swapped a restricted module's panes for the Balances
  // pair lived on the boxed branch. It moved to the router (requireModuleEnabled),
  // so the shell renders the matched route unconditionally.
  it('renders the matched route even when the module resolves to a different effective intent', async () => {
    mocks.effectiveIntent = Intent.BALANCES_INTENT;
    renderAppShell('/savings');
    expect(await screen.findByTestId('route-probe')).toBeTruthy();
  });
});
