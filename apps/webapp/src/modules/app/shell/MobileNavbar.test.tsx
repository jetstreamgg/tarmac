import { act, fireEvent, render, screen } from '@testing-library/react';
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
import { Intent } from '@/lib/enums';
import { ROUTES } from '@/lib/routes';
import { MobileNavbar } from './MobileNavbar';

const mocks = vi.hoisted(() => ({
  chainId: 1,
  chains: [
    { id: 1, name: 'Ethereum' },
    { id: 8453, name: 'Base' }
  ] as { id: number; name: string }[],
  setIsSwitchingNetwork: vi.fn(),
  setIsAutoSwitching: vi.fn()
}));

vi.mock('wagmi', async importOriginal => {
  const actual = await importOriginal<typeof import('wagmi')>();
  return {
    ...actual,
    useChainId: () => mocks.chainId,
    useChains: () => mocks.chains
  };
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

beforeEach(() => {
  mocks.chainId = 1;
  mocks.chains = [
    { id: 1, name: 'Ethereum' },
    { id: 8453, name: 'Base' }
  ];
  mocks.setIsSwitchingNetwork.mockClear();
  mocks.setIsAutoSwitching.mockClear();
  localStorage.clear();
  Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
});

// Memory-router harness mirroring TopNav.test.tsx: MobileNavbar at the root,
// stub routes for every path the tests navigate to.
function renderMobileNavbar(initialPath = '/') {
  const rootRoute = createRootRoute({
    component: () => (
      <>
        <MobileNavbar />
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
    stubRoute('/savings', Intent.SAVINGS_INTENT)
  ]);
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [initialPath] })
  });

  render(
    <I18nWidgetProvider locale="en">
      <RouterProvider router={router as any} />
    </I18nWidgetProvider>
  );
  return router;
}

describe('MobileNavbar destinations', () => {
  it('renders the 4 destinations with mobile testids linking to the route map paths', async () => {
    renderMobileNavbar();

    expect((await screen.findByTestId('mobile-nav-portfolio')).getAttribute('href')).toBe(ROUTES.PORTFOLIO);
    expect(screen.getByTestId('mobile-nav-earn').getAttribute('href')).toBe(ROUTES.EARN);
    expect(screen.getByTestId('mobile-nav-stake').getAttribute('href')).toBe(ROUTES.STAKE);
    expect(screen.getByTestId('mobile-nav-convert').getAttribute('href')).toBe(ROUTES.CONVERT);
  });

  it('keeps every destination accessibly named while only the active one shows its label', async () => {
    renderMobileNavbar(ROUTES.PORTFOLIO);
    await screen.findByTestId('mobile-nav-portfolio');

    // Icon-only inactive items still expose their destination name.
    expect(screen.getByRole('link', { name: 'Portfolio' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Earn' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Stake SKY' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Convert' })).toBeTruthy();
  });
});

describe('MobileNavbar active destination', () => {
  async function activeTestIds(): Promise<string[]> {
    await screen.findByTestId('mobile-nav-portfolio');
    return ['mobile-nav-portfolio', 'mobile-nav-earn', 'mobile-nav-stake', 'mobile-nav-convert'].filter(
      testId => screen.getByTestId(testId).getAttribute('aria-current') === 'page'
    );
  }

  it('marks the destination matching the current path', async () => {
    renderMobileNavbar(ROUTES.STAKE);
    expect(await activeTestIds()).toEqual(['mobile-nav-stake']);
  });

  it('marks the owning destination while a legacy module path is mounted', async () => {
    renderMobileNavbar('/savings');
    expect(await activeTestIds()).toEqual(['mobile-nav-earn']);
  });
});

// Parity with TopNav: both navs share the destination link plumbing, so the
// mainnet-only override and the switch feedback must behave identically.
describe('MobileNavbar network override', () => {
  it('carries network=ethereum on the mainnet-only Stake link when on an L2', async () => {
    mocks.chainId = 8453;
    renderMobileNavbar();

    expect((await screen.findByTestId('mobile-nav-stake')).getAttribute('href')).toBe(
      `${ROUTES.STAKE}?network=ethereum`
    );
    expect(screen.getByTestId('mobile-nav-convert').getAttribute('href')).toBe(ROUTES.CONVERT);
  });

  it('flags the auto-switch when plainly clicking a mainnet-only destination from an L2', async () => {
    mocks.chainId = 8453;
    renderMobileNavbar();

    fireEvent.click(await screen.findByTestId('mobile-nav-stake'));

    expect(mocks.setIsSwitchingNetwork).toHaveBeenCalledWith(true);
    expect(mocks.setIsAutoSwitching).toHaveBeenCalledWith(true);
  });

  it('skips the side effect on modified clicks (new tab: this tab does not navigate)', async () => {
    mocks.chainId = 8453;
    renderMobileNavbar();

    fireEvent.click(await screen.findByTestId('mobile-nav-stake'), { metaKey: true });

    expect(mocks.setIsSwitchingNetwork).not.toHaveBeenCalled();
  });
});

// The active-state gradient is one shared element (motion layoutId) so it
// slides between destinations on tab switch instead of popping.
describe('MobileNavbar active pill', () => {
  it('renders exactly one pill, inside the active destination, and it follows navigation', async () => {
    renderMobileNavbar(ROUTES.PORTFOLIO);
    await screen.findByTestId('mobile-nav-portfolio');

    let pills = screen.getAllByTestId('mobile-nav-active-pill');
    expect(pills).toHaveLength(1);
    expect(screen.getByTestId('mobile-nav-portfolio').contains(pills[0])).toBe(true);

    fireEvent.click(screen.getByTestId('mobile-nav-stake'));
    await screen.findByTestId('mobile-nav-stake');

    pills = screen.getAllByTestId('mobile-nav-active-pill');
    expect(pills).toHaveLength(1);
    expect(screen.getByTestId('mobile-nav-stake').contains(pills[0])).toBe(true);
  });
});

// M2.1 (APP-379): the bar slides away while scrolling down and returns on
// scroll up; data-state carries the current phase for styling and tests.
describe('MobileNavbar hide-on-scroll', () => {
  function scrollTo(y: number) {
    act(() => {
      Object.defineProperty(window, 'scrollY', { value: y, configurable: true });
      window.dispatchEvent(new Event('scroll'));
    });
  }

  it('hides on scroll down and reappears on scroll up', async () => {
    renderMobileNavbar();
    const navbar = await screen.findByTestId('mobile-navbar');
    expect(navbar.getAttribute('data-state')).toBe('visible');

    scrollTo(300);
    expect(navbar.getAttribute('data-state')).toBe('hidden');

    scrollTo(250);
    expect(navbar.getAttribute('data-state')).toBe('visible');
  });
});

// NEW_INTENTS currently contains the Fixed module, which lives under Earn.
describe('MobileNavbar new-module dot', () => {
  it('shows the dot on the destination owning an unseen new module', async () => {
    renderMobileNavbar();
    await screen.findByTestId('mobile-nav-earn');
    expect(screen.queryByTestId('mobile-nav-earn-new-dot')).toBeTruthy();
    expect(screen.queryByTestId('mobile-nav-portfolio-new-dot')).toBeNull();
  });

  it('hides the dot once the new module was seen in a previous session', async () => {
    localStorage.setItem('seenNewNavIntents', JSON.stringify([Intent.FIXED_INTENT]));
    renderMobileNavbar();
    await screen.findByTestId('mobile-nav-earn');
    expect(screen.queryByTestId('mobile-nav-earn-new-dot')).toBeNull();
  });
});
