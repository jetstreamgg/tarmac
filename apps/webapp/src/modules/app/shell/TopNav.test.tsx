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
  // Production-like by default (no tenderly fork); tests override to a
  // dev-like list to exercise the fork-preferring switch target.
  chains: [
    { id: 1, name: 'Ethereum' },
    { id: 8453, name: 'Base' }
  ] as { id: number; name: string }[],
  showBanner: vi.fn(),
  setIsSwitchingNetwork: vi.fn(),
  setIsAutoSwitching: vi.fn()
}));

// Pin the JS breakpoint per test (happy-dom's 1024 viewport = desktop popover).
const breakpoint = vi.hoisted(() => ({ isMobile: false }));
vi.mock('@/hooks/ui/useBreakpoint', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks/ui/useBreakpoint')>();
  return {
    ...actual,
    useBreakpointIndex: () => ({ bpi: breakpoint.isMobile ? actual.BP.sm : actual.BP.desktop })
  };
});

vi.mock('wagmi', async importOriginal => {
  const actual = await importOriginal<typeof import('wagmi')>();
  return {
    ...actual,
    useChainId: () => mocks.chainId,
    useChains: () => mocks.chains
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

vi.mock('./WalletChip', () => ({
  WalletChip: () => <div data-testid="wallet-chip" data-stub="wallet-chip-stub" />
}));

vi.mock('@/modules/layout/components/MockConnectButton', () => ({
  MockConnectButton: () => <div data-testid="mock-connect-button-stub" />
}));

vi.mock('@/components/ThemeToggle', () => ({
  ThemeToggle: () => <div data-testid="theme-toggle-stub" />
}));

// The upgrade-modal opener reads the TransactionContext (absent here); the
// modal flow is covered by its own tests — this only asserts the row wiring.
const upgradeMocks = vi.hoisted(() => ({ open: vi.fn() }));
vi.mock('@/modules/upgrade/hooks/useUpgradeModal', () => ({
  useUpgradeModal: () => ({ open: upgradeMocks.open })
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
  mocks.chains = [
    { id: 1, name: 'Ethereum' },
    { id: 8453, name: 'Base' }
  ];
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

describe('TopNav mock wallet connect', () => {
  it('mounts the MockConnectButton when VITE_USE_MOCK_WALLET is on (e2e connects through it)', async () => {
    vi.stubEnv('VITE_USE_MOCK_WALLET', 'true');
    renderTopNav();
    expect(await screen.findByTestId('mock-connect-button-stub')).toBeTruthy();
  });

  it('omits the MockConnectButton otherwise', async () => {
    renderTopNav();
    await screen.findByTestId('nav-portfolio');
    expect(screen.queryByTestId('mock-connect-button-stub')).toBeNull();
  });
});

describe('TopNav wallet chip', () => {
  it('mounts the WalletChip (which owns the V2 wallet-chip testid)', async () => {
    renderTopNav();
    const chip = await screen.findByTestId('wallet-chip');
    expect(chip.getAttribute('data-stub')).toBe('wallet-chip-stub');
  });
});

// The "new module" dot was retired with APP-457 (nothing is new right now, and
// the indicator is not coming back); the nav carries no badge of any kind.
describe('TopNav new-module dot', () => {
  it('never renders a dot on a destination', async () => {
    renderTopNav();
    await screen.findByTestId('nav-earn');
    expect(screen.queryByTestId('nav-earn-new-dot')).toBeNull();
  });
});

describe('TopNav pill geometry', () => {
  // The button recipe's base carries `rounded-xl` and the navbar size overrides
  // it with `rounded-full`. cva only concatenates, so the class list has to go
  // through cn()/tailwind-merge or both survive and the radius is decided by
  // whichever utility the stylesheet emits last.
  it('resolves the radius to the navbar pill, not the base square', async () => {
    renderTopNav();
    const link = await screen.findByTestId('nav-earn');
    expect(link.className).toContain('rounded-full');
    expect(link.className).not.toContain('rounded-xl');
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

    // The Upgrade DAI/MKR shortcut landed with APP-413 (modal surface).
    expect(screen.getByTestId('nav-more-upgrade')).toBeTruthy();
    expect(screen.getByTestId('batch-transactions-toggle-stub')).toBeTruthy();
    expect(screen.getByTestId('theme-toggle-stub')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Docs/ }).getAttribute('href')).toBe('https://docs.sky.money/');
    expect(screen.getByRole('link', { name: /Terms/ })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Privacy/ })).toBeTruthy();

    fireEvent.click(screen.getByTestId('nav-more-cookie-settings'));
    expect(mocks.showBanner).toHaveBeenCalledTimes(1);
  });
});

describe('TopNav More menu — mobile bottom panel (M4.5)', () => {
  beforeEach(() => {
    breakpoint.isMobile = true;
  });
  afterEach(() => {
    breakpoint.isMobile = false;
  });

  it('opens the comp bottom panel (dialog with More heading + close) instead of the popover', async () => {
    vi.stubEnv('VITE_FOOTER_LINKS', JSON.stringify([{ url: 'https://sky.money/terms', name: 'Terms' }]));
    renderTopNav();

    fireEvent.click(await screen.findByTestId('nav-more'));

    const panel = await screen.findByRole('dialog');
    expect(panel).toBeTruthy();
    expect(screen.getByText('More')).toBeTruthy();
    // Same rows as the desktop menu (content parity; comp omits Dark mode — kept deliberately).
    expect(screen.getByTestId('batch-transactions-toggle-stub')).toBeTruthy();
    expect(screen.getByTestId('theme-toggle-stub')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Terms/ })).toBeTruthy();
    expect(screen.getByTestId('nav-more-cookie-settings')).toBeTruthy();
  });

  it('closes through the panel close button', async () => {
    renderTopNav();

    fireEvent.click(await screen.findByTestId('nav-more'));
    fireEvent.click(await screen.findByTestId('nav-more-close'));

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('still opens the cookie banner from the panel', async () => {
    renderTopNav();

    fireEvent.click(await screen.findByTestId('nav-more'));
    fireEvent.click(await screen.findByTestId('nav-more-cookie-settings'));

    expect(mocks.showBanner).toHaveBeenCalledTimes(1);
    // The row closes the panel like the desktop menu does.
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('launches the upgrade modal from the panel and closes it (APP-413)', async () => {
    renderTopNav();

    fireEvent.click(await screen.findByTestId('nav-more'));
    fireEvent.click(await screen.findByTestId('nav-more-upgrade'));

    expect(upgradeMocks.open).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

// A mainnet-only destination used to carry `?network=ethereum` in its href, and
// clicking one raised the switching feedback on the spot. `network=` is retired,
// so a nav link is just a path: the route guard resolves the chain on arrival
// and raises its own feedback — which also means the click must NOT raise it,
// since the guard may decide not to switch and only a real chain change clears
// the flags.
describe('TopNav destination links carry no chain', () => {
  it('links Stake plainly from an L2', async () => {
    mocks.chainId = base.id;
    renderTopNav();

    expect((await screen.findByTestId('nav-stake')).getAttribute('href')).toBe(ROUTES.STAKE);
    expect(screen.getByTestId('nav-convert').getAttribute('href')).toBe(ROUTES.CONVERT);
  });

  it('links Stake plainly from mainnet', async () => {
    renderTopNav();
    expect((await screen.findByTestId('nav-stake')).getAttribute('href')).toBe(ROUTES.STAKE);
  });

  it('does not flag a switch when clicking a mainnet-only destination from an L2', async () => {
    mocks.chainId = base.id;
    renderTopNav();

    fireEvent.click(await screen.findByTestId('nav-stake'));

    expect(mocks.setIsSwitchingNetwork).not.toHaveBeenCalled();
    expect(mocks.setIsAutoSwitching).not.toHaveBeenCalled();
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
