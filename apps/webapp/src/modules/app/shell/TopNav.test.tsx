import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { base, mainnet } from 'viem/chains';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider
} from '@tanstack/react-router';
import { I18nWidgetProvider } from '@/widgets/context/I18nWidgetProvider';
import { Intent } from '@/lib/enums';
import { ROUTES } from '@/lib/routes';
import { TopNav } from './TopNav';

const mocks = vi.hoisted(() => ({
  chainId: 1,
  showBanner: vi.fn(),
  setIsSwitchingNetwork: vi.fn(),
  setIsAutoSwitching: vi.fn()
}));

vi.mock('wagmi', async importOriginal => {
  const actual = await importOriginal<typeof import('wagmi')>();
  return {
    ...actual,
    useChainId: () => mocks.chainId
  };
});

// Import-time env flag; force it on so the menu exercises the toggle slot.
vi.mock('@/lib/constants', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/constants')>();
  return { ...actual, BATCH_TX_ENABLED: true };
});

// Wallet-dependent components stubbed: TopNav composes them, their behavior is
// covered by their own tests.
vi.mock('@/components/BatchTransactionsToggle', () => ({
  BatchTransactionsToggle: () => <div data-testid="batch-transactions-toggle-stub" />
}));

vi.mock('@/modules/layout/components/CustomConnectButton', () => ({
  CustomConnectButton: () => <div data-testid="custom-connect-button-stub" />
}));

vi.mock('@/components/ThemeToggle', () => ({
  ThemeToggle: () => <div data-testid="theme-toggle-stub" />
}));

vi.mock('@/modules/analytics/PostHogProvider', async importOriginal => {
  const actual = await importOriginal<typeof import('@/modules/analytics/PostHogProvider')>();
  return { ...actual, POSTHOG_ENABLED: true };
});

vi.mock('@/modules/ui/context/NetworkSwitchContext', async importOriginal => {
  const actual = await importOriginal<typeof import('@/modules/ui/context/NetworkSwitchContext')>();
  return {
    ...actual,
    useNetworkSwitch: () => ({
      isSwitchingNetwork: false,
      setIsSwitchingNetwork: mocks.setIsSwitchingNetwork,
      isAutoSwitching: false,
      setIsAutoSwitching: mocks.setIsAutoSwitching
    })
  };
});

vi.mock('@/modules/analytics/context/CookieConsentContext', async importOriginal => {
  const actual = await importOriginal<typeof import('@/modules/analytics/context/CookieConsentContext')>();
  return { ...actual, useCookieConsent: () => ({ showBanner: mocks.showBanner }) };
});

beforeEach(() => {
  mocks.chainId = mainnet.id;
  mocks.showBanner.mockClear();
  mocks.setIsSwitchingNetwork.mockClear();
  mocks.setIsAutoSwitching.mockClear();
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// Memory-router harness: TopNav at the root, stub routes for every path the
// tests navigate to (staticData mirrors the real routes' intents).
function renderTopNav(initialPath = '/') {
  const rootRoute = createRootRoute({
    component: () => (
      <>
        <TopNav />
        <Outlet />
      </>
    )
  });
  const stubRoute = (path: string, intent?: Intent) =>
    createRoute({
      getParentRoute: () => rootRoute,
      path,
      component: () => null,
      ...(intent ? { staticData: { intent } } : {})
    });
  const routeTree = rootRoute.addChildren([
    stubRoute('/', Intent.BALANCES_INTENT),
    stubRoute(ROUTES.PORTFOLIO, Intent.BALANCES_INTENT),
    stubRoute(ROUTES.EARN),
    stubRoute(ROUTES.STAKE, Intent.STAKE_INTENT),
    stubRoute(ROUTES.CONVERT, Intent.CONVERT_INTENT),
    stubRoute('/savings', Intent.SAVINGS_INTENT),
    stubRoute('/fixed', Intent.FIXED_INTENT)
  ]);
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [initialPath] })
  });

  render(
    <I18nWidgetProvider locale="en">
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <RouterProvider router={router as any} />
    </I18nWidgetProvider>
  );
  return router;
}

describe('TopNav destinations', () => {
  it('renders the 4 destinations with V2 testids linking to the route map paths', async () => {
    renderTopNav();

    expect((await screen.findByTestId('nav-portfolio')).getAttribute('href')).toBe(ROUTES.PORTFOLIO);
    expect(screen.getByTestId('nav-earn').getAttribute('href')).toBe(ROUTES.EARN);
    expect(screen.getByTestId('nav-stake').getAttribute('href')).toBe(ROUTES.STAKE);
    expect(screen.getByTestId('nav-convert').getAttribute('href')).toBe(ROUTES.CONVERT);
  });
});

describe('TopNav wallet chip', () => {
  it('wraps the existing connect button under the V2 wallet-chip testid', async () => {
    renderTopNav();
    const chip = await screen.findByTestId('wallet-chip');
    expect(chip.querySelector('[data-testid="custom-connect-button-stub"]')).toBeTruthy();
  });
});

// NEW_INTENTS currently contains the Fixed module, which lives under Earn.
describe('TopNav new-module dot', () => {
  it('shows the dot on the destination owning an unseen new module', async () => {
    renderTopNav();
    await screen.findByTestId('nav-earn');
    expect(screen.queryByTestId('nav-earn-new-dot')).toBeTruthy();
    expect(screen.queryByTestId('nav-portfolio-new-dot')).toBeNull();
  });

  it('hides the dot once the new module was seen in a previous session', async () => {
    localStorage.setItem('seenNewNavIntents', JSON.stringify([Intent.FIXED_INTENT]));
    renderTopNav();
    await screen.findByTestId('nav-earn');
    expect(screen.queryByTestId('nav-earn-new-dot')).toBeNull();
  });

  it('clears the dot when landing on the new module route', async () => {
    renderTopNav('/fixed');
    await screen.findByTestId('nav-earn');
    expect(screen.queryByTestId('nav-earn-new-dot')).toBeNull();
  });
});

describe('TopNav More menu', () => {
  it('lists batch toggle, upgrade shortcut, legal links and cookie settings', async () => {
    vi.stubEnv(
      'VITE_FOOTER_LINKS',
      JSON.stringify([
        { url: 'https://docs.sky.money/', name: 'Docs' },
        { url: 'https://sky.money/terms', name: 'Terms' },
        { url: 'https://sky.money/privacy', name: 'Privacy' }
      ])
    );
    renderTopNav();

    fireEvent.click(await screen.findByTestId('nav-more'));

    expect((await screen.findByTestId('nav-more-upgrade')).getAttribute('href')).toBe('/convert/upgrade');
    expect(screen.getByTestId('batch-transactions-toggle-stub')).toBeTruthy();
    expect(screen.getByTestId('theme-toggle-stub')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Docs/ }).getAttribute('href')).toBe('https://docs.sky.money/');
    expect(screen.getByRole('link', { name: /Terms/ })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Privacy/ })).toBeTruthy();

    fireEvent.click(screen.getByTestId('nav-more-cookie-settings'));
    expect(mocks.showBanner).toHaveBeenCalledTimes(1);
  });
});

describe('TopNav network override', () => {
  it('carries network=ethereum on the mainnet-only Stake link when on an L2', async () => {
    mocks.chainId = base.id;
    renderTopNav();

    expect((await screen.findByTestId('nav-stake')).getAttribute('href')).toBe(
      `${ROUTES.STAKE}?network=ethereum`
    );
    expect(screen.getByTestId('nav-convert').getAttribute('href')).toBe(ROUTES.CONVERT);
  });

  it('links Stake plainly from mainnet', async () => {
    renderTopNav();
    expect((await screen.findByTestId('nav-stake')).getAttribute('href')).toBe(ROUTES.STAKE);
  });
});

describe('TopNav network switch feedback', () => {
  it('flags the auto-switch when plainly clicking a mainnet-only destination from an L2', async () => {
    mocks.chainId = base.id;
    renderTopNav();

    fireEvent.click(await screen.findByTestId('nav-stake'));

    expect(mocks.setIsSwitchingNetwork).toHaveBeenCalledWith(true);
    expect(mocks.setIsAutoSwitching).toHaveBeenCalledWith(true);
  });

  it('skips the side effect on modified clicks (new tab: this tab does not navigate)', async () => {
    mocks.chainId = base.id;
    renderTopNav();

    fireEvent.click(await screen.findByTestId('nav-stake'), { metaKey: true });

    expect(mocks.setIsSwitchingNetwork).not.toHaveBeenCalled();
  });

  it('does not flag switches for multichain destinations', async () => {
    mocks.chainId = base.id;
    renderTopNav();

    fireEvent.click(await screen.findByTestId('nav-convert'));

    expect(mocks.setIsSwitchingNetwork).not.toHaveBeenCalled();
  });
});

describe('TopNav active destination', () => {
  async function activeTestIds(): Promise<string[]> {
    await screen.findByTestId('nav-portfolio');
    return ['nav-portfolio', 'nav-earn', 'nav-stake', 'nav-convert'].filter(
      testId => screen.getByTestId(testId).getAttribute('aria-current') === 'page'
    );
  }

  it('marks the destination matching the current path', async () => {
    renderTopNav(ROUTES.STAKE);
    expect(await activeTestIds()).toEqual(['nav-stake']);
  });

  it('marks Earn on the intent-less /earn placeholder', async () => {
    renderTopNav(ROUTES.EARN);
    expect(await activeTestIds()).toEqual(['nav-earn']);
  });

  it('marks the owning destination while a legacy module path is mounted', async () => {
    renderTopNav('/savings');
    expect(await activeTestIds()).toEqual(['nav-earn']);
  });

  it('marks Portfolio on the legacy landing route', async () => {
    renderTopNav('/');
    expect(await activeTestIds()).toEqual(['nav-portfolio']);
  });
});
