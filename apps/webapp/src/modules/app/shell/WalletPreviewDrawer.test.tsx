import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import {
  AnyRouter,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider
} from '@tanstack/react-router';
import { I18nWidgetProvider } from '@/widgets/context/I18nWidgetProvider';
import { TooltipProvider } from '@/components/ui/tooltip';
import { WalletPreviewDrawer } from './WalletPreviewDrawer';

const ADDRESS = '0x1234567890abcdef1234567890abcdef12345678';

const mocks = vi.hoisted(() => ({
  connection: {
    isConnected: true,
    address: '0x1234567890abcdef1234567890abcdef12345678' as string | undefined,
    connector: undefined
  },
  chainId: 1,
  isMobile: false,
  isSafeWallet: false,
  isRegionRestricted: false,
  walletAssets: {
    assets: [
      {
        symbol: 'USDS',
        name: 'Sky USD',
        amount: 1000,
        amountUsd: 1000,
        bestRate: 0.0475,
        multipleVenues: true
      },
      {
        symbol: 'USDC',
        name: 'USD Coin',
        amount: 1000,
        amountUsd: 1000,
        bestRate: 0.0525,
        multipleVenues: true
      },
      {
        symbol: 'USDT',
        name: 'Tether USD',
        amount: 0,
        amountUsd: 0,
        bestRate: 0.0425,
        multipleVenues: false
      },
      { symbol: 'SKY', name: 'Sky Token', amount: 0, amountUsd: 0, bestRate: 0.107, multipleVenues: false }
    ],
    totalUsd: 2000,
    isLoading: false
  },
  disconnect: vi.fn(),
  openConnectModal: vi.fn()
}));

vi.mock('wagmi', async importOriginal => {
  const actual = await importOriginal<typeof import('wagmi')>();
  return {
    ...actual,
    useConnection: () => mocks.connection,
    useChainId: () => mocks.chainId
  };
});

vi.mock('@/hooks', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks')>();
  return {
    ...actual,
    useIsSafeWallet: () => mocks.isSafeWallet,
    // happy-dom evaluates matchMedia at its 1024px default, so the real hook
    // always lands on the desktop drawer; the flag drives the M4.6 mobile panel.
    useBreakpointIndex: () => ({ bpi: mocks.isMobile ? actual.BP.sm : actual.BP.desktop })
  };
});

vi.mock('@/modules/ui/context/ConnectModalContext', async importOriginal => {
  const actual = await importOriginal<typeof import('@/modules/ui/context/ConnectModalContext')>();
  return { ...actual, useConnectModal: () => ({ openConnectModal: mocks.openConnectModal }) };
});

vi.mock('./NetworkSelector', () => ({
  NetworkSelector: () => <div data-testid="wallet-drawer-network" />
}));

vi.mock('@/modules/config/hooks/useConfigContext', () => ({
  useConfigContext: () => ({ onExternalLinkClicked: undefined })
}));

// The drawer's balance/rate wiring has its own coverage; the components under
// test consume the aggregated shape.
vi.mock('./useWalletDrawerAssets', () => ({
  useWalletDrawerAssets: () => mocks.walletAssets
}));

// Tab contents are the shared balance widgets; their behavior has its own coverage.
vi.mock('@/widgets', async importOriginal => {
  const actual = await importOriginal<typeof import('@/widgets')>();
  return {
    ...actual,
    BalancesHistory: () => <div data-testid="balances-history-stub" />
  };
});

vi.mock('@/modules/geo-config', async importOriginal => {
  const actual = await importOriginal<typeof import('@/modules/geo-config')>();
  return { ...actual, useGeoConfig: () => ({ isRegionRestricted: mocks.isRegionRestricted }) };
});

beforeEach(() => {
  mocks.connection = { isConnected: true, address: ADDRESS, connector: undefined };
  mocks.chainId = 1;
  mocks.isMobile = false;
  mocks.isSafeWallet = false;
  mocks.isRegionRestricted = false;
  mocks.disconnect.mockClear();
  mocks.openConnectModal.mockClear();
});

let lastRouter: AnyRouter | undefined;

// Stateful host mirroring WalletChip's wiring: mounts closed, opened via the trigger.
function DrawerHost({ ensName }: { ensName?: string | null }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <button data-testid="open-drawer" onClick={() => setIsOpen(true)} />
      <WalletPreviewDrawer
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        ensName={ensName}
        onDisconnect={mocks.disconnect}
      />
    </>
  );
}

function renderDrawer({ ensName }: { ensName?: string | null } = {}) {
  const rootRoute = createRootRoute({
    component: () => (
      <>
        <DrawerHost ensName={ensName} />
        <Outlet />
      </>
    )
  });
  const stubRoute = (path: string) =>
    createRoute({ getParentRoute: () => rootRoute, path, component: () => null });
  const router = createRouter({
    routeTree: rootRoute.addChildren([
      stubRoute('/'),
      stubRoute('/savings'),
      stubRoute('/earn'),
      stubRoute('/stake')
    ]),
    history: createMemoryHistory({ initialEntries: ['/'] })
  });
  lastRouter = router;

  render(
    <I18nWidgetProvider locale="en">
      <TooltipProvider>
        <RouterProvider router={router as never} />
      </TooltipProvider>
    </I18nWidgetProvider>
  );
  return router;
}

async function openDrawer() {
  fireEvent.click(await screen.findByTestId('open-drawer'));
  return await screen.findByTestId('wallet-drawer');
}

describe('WalletPreviewDrawer', () => {
  it('renders the V2 wallet-drawer surface when open', async () => {
    renderDrawer();
    expect(await openDrawer()).toBeTruthy();
  });

  it('shows ENS name, truncated address, copy control and network selector', async () => {
    renderDrawer({ ensName: 'bartoo.eth' });
    const drawer = await openDrawer();

    expect(drawer.textContent).toContain('bartoo.eth');
    expect(drawer.textContent).toContain('0x1234...5678');
    expect(drawer.querySelector('[data-testid="copy-to-clipboard"]')).toBeTruthy();
    expect(drawer.querySelector('[data-testid="wallet-drawer-network"]')).toBeTruthy();
  });

  it('shows the wallet assets total USD value', async () => {
    renderDrawer();
    const drawer = await openDrawer();

    expect(drawer.querySelector('[data-testid="wallet-drawer-total"]')?.textContent).toContain('2,000');
  });

  it('disconnects via the header action', async () => {
    renderDrawer();
    const drawer = await openDrawer();

    fireEvent.click(drawer.querySelector('[data-testid="wallet-drawer-disconnect"]')!);
    expect(mocks.disconnect).toHaveBeenCalledTimes(1);
  });

  it('opens the connect modal (and closes) via the switch-account action', async () => {
    renderDrawer();
    const drawer = await openDrawer();

    fireEvent.click(drawer.querySelector('[data-testid="wallet-drawer-switch-account"]')!);
    expect(mocks.openConnectModal).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('wallet-drawer')).toBeNull();
  });

  it('hides the switch-account and disconnect actions for Safe wallets', async () => {
    mocks.isSafeWallet = true;
    renderDrawer();
    const drawer = await openDrawer();

    expect(drawer.querySelector('[data-testid="wallet-drawer-disconnect"]')).toBeNull();
    expect(drawer.querySelector('[data-testid="wallet-drawer-switch-account"]')).toBeNull();
  });

  it('lists the wallet assets with rate badges on the Assets tab and switches to Activity', async () => {
    renderDrawer();
    const drawer = await openDrawer();

    expect(drawer.querySelector('[data-testid="wallet-drawer-assets"]')).toBeTruthy();
    const usdsRow = drawer.querySelector('[data-testid="wallet-drawer-asset-usds"]');
    expect(usdsRow?.textContent).toContain('USDS');
    expect(usdsRow?.textContent).toContain('up to 4.75%');
    expect(drawer.querySelector('[data-testid="balances-history-stub"]')).toBeNull();

    // Radix tabs activate on mousedown, not click.
    fireEvent.mouseDown(drawer.querySelector('[data-testid="wallet-drawer-tab-activity"]')!, {
      button: 0
    });

    expect(drawer.querySelector('[data-testid="balances-history-stub"]')).toBeTruthy();
    expect(drawer.querySelector('[data-testid="wallet-drawer-assets"]')).toBeNull();

    fireEvent.mouseDown(drawer.querySelector('[data-testid="wallet-drawer-tab-assets"]')!, { button: 0 });
    expect(drawer.querySelector('[data-testid="wallet-drawer-assets"]')).toBeTruthy();
  });

  it('hides rate badges and earn CTAs when the region is restricted', async () => {
    mocks.isRegionRestricted = true;
    renderDrawer();
    const drawer = await openDrawer();

    const usdsRow = drawer.querySelector('[data-testid="wallet-drawer-asset-usds"]');
    expect(usdsRow).toBeTruthy();
    expect(usdsRow?.textContent).not.toContain('up to 4.75%');
    expect(drawer.querySelector('[data-testid="wallet-drawer-earn-usds"]')).toBeNull();
  });

  it('deep-links to Earn filtered by token from the Start earning CTA', async () => {
    renderDrawer();
    const drawer = await openDrawer();

    await act(async () => {
      fireEvent.click(drawer.querySelector('[data-testid="wallet-drawer-earn-usds"]')!);
    });

    expect(lastRouter!.state.location.pathname).toBe('/earn');
    expect(lastRouter!.state.location.search).toMatchObject({ token: 'USDS' });
    // The navigation closes the drawer.
    expect(screen.queryByTestId('wallet-drawer')).toBeNull();
  });

  it('routes SKY to Stake from the Start earning CTA', async () => {
    renderDrawer();
    const drawer = await openDrawer();

    await act(async () => {
      fireEvent.click(drawer.querySelector('[data-testid="wallet-drawer-earn-sky"]')!);
    });

    expect(lastRouter!.state.location.pathname).toBe('/stake');
  });

  it('closes when a navigation happens', async () => {
    renderDrawer();
    await openDrawer();

    await act(async () => {
      await lastRouter!.navigate({ to: '/earn/savings' });
    });

    expect(screen.queryByTestId('wallet-drawer')).toBeNull();
  });

  it('keeps the desktop collapse rail and no header close button at md+', async () => {
    renderDrawer();
    const drawer = await openDrawer();

    expect(drawer.querySelector('[data-testid="wallet-drawer-collapse"]')).toBeTruthy();
    expect(drawer.querySelector('[data-testid="wallet-drawer-close"]')).toBeNull();
  });
});

describe('WalletPreviewDrawer — mobile panel (M4.6)', () => {
  beforeEach(() => {
    mocks.isMobile = true;
  });

  it('presents the full panel with a header close button instead of the collapse rail', async () => {
    renderDrawer({ ensName: 'bartoo.eth' });
    const drawer = await openDrawer();

    expect(drawer.querySelector('[data-testid="wallet-drawer-close"]')).toBeTruthy();
    expect(drawer.querySelector('[data-testid="wallet-drawer-collapse"]')).toBeNull();
    // Same content contract as the desktop drawer.
    expect(drawer.textContent).toContain('bartoo.eth');
    expect(drawer.querySelector('[data-testid="wallet-drawer-total"]')?.textContent).toContain('2,000');
    expect(drawer.querySelector('[data-testid="wallet-drawer-network"]')).toBeTruthy();
    expect(drawer.querySelector('[data-testid="wallet-drawer-assets"]')).toBeTruthy();
  });

  it('dismisses via the header close button', async () => {
    renderDrawer();
    const drawer = await openDrawer();

    fireEvent.click(drawer.querySelector('[data-testid="wallet-drawer-close"]')!);
    expect(screen.queryByTestId('wallet-drawer')).toBeNull();
  });

  it('keeps switch-account and disconnect working in the mobile header', async () => {
    renderDrawer();
    const drawer = await openDrawer();

    fireEvent.click(drawer.querySelector('[data-testid="wallet-drawer-disconnect"]')!);
    expect(mocks.disconnect).toHaveBeenCalledTimes(1);

    fireEvent.click(drawer.querySelector('[data-testid="wallet-drawer-switch-account"]')!);
    expect(mocks.openConnectModal).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('wallet-drawer')).toBeNull();
  });

  it('still shows the close button for Safe wallets while hiding the account actions', async () => {
    mocks.isSafeWallet = true;
    renderDrawer();
    const drawer = await openDrawer();

    expect(drawer.querySelector('[data-testid="wallet-drawer-close"]')).toBeTruthy();
    expect(drawer.querySelector('[data-testid="wallet-drawer-switch-account"]')).toBeNull();
    expect(drawer.querySelector('[data-testid="wallet-drawer-disconnect"]')).toBeNull();
  });
});
