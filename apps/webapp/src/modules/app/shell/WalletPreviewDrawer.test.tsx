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
import { getEtherscanLink } from '@/utils';
import { WalletPreviewDrawer } from './WalletPreviewDrawer';

const ADDRESS = '0x1234567890abcdef1234567890abcdef12345678';

const mocks = vi.hoisted(() => ({
  connection: {
    isConnected: true,
    address: '0x1234567890abcdef1234567890abcdef12345678' as string | undefined,
    connector: undefined
  },
  chainId: 1,
  isSafeWallet: false,
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
  return { ...actual, useIsSafeWallet: () => mocks.isSafeWallet };
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

vi.mock('@/widgets/BalancesWidget/hooks/useSuppliedBalancesTotalUsd', () => ({
  useSuppliedBalancesTotalUsd: () => ({ totalUsd: 4605.2, isLoading: false })
}));

// Tab contents are the shared balance widgets; their behavior has its own coverage.
vi.mock('@/widgets', async importOriginal => {
  const actual = await importOriginal<typeof import('@/widgets')>();
  return {
    ...actual,
    ModulesBalances: () => <div data-testid="modules-balances-stub" />,
    BalancesHistory: () => <div data-testid="balances-history-stub" />
  };
});

vi.mock('@/modules/app/hooks/useModuleUrls', () => ({
  useModuleUrls: () => ({
    rewardsUrl: '/rewards',
    savingsUrlMap: { 1: '/savings' },
    stakeUrl: '/stake',
    stusdsUrl: '/earn/stusds',
    vaultsUrl: '/vaults',
    convertUrl: '/convert',
    fixedYieldUrl: '/fixed'
  })
}));

vi.mock('@/modules/geo-config', async importOriginal => {
  const actual = await importOriginal<typeof import('@/modules/geo-config')>();
  return { ...actual, useGeoConfig: () => ({ isRegionRestricted: false }) };
});

beforeEach(() => {
  mocks.connection = { isConnected: true, address: ADDRESS, connector: undefined };
  mocks.chainId = 1;
  mocks.isSafeWallet = false;
  mocks.disconnect.mockClear();
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
    routeTree: rootRoute.addChildren([stubRoute('/'), stubRoute('/savings')]),
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

  it('shows ENS name, truncated address, copy control, explorer link and network selector', async () => {
    renderDrawer({ ensName: 'bartoo.eth' });
    const drawer = await openDrawer();

    expect(drawer.textContent).toContain('bartoo.eth');
    expect(drawer.textContent).toContain('0x12345...45678');
    expect(drawer.querySelector('[data-testid="copy-to-clipboard"]')).toBeTruthy();
    expect(drawer.querySelector('[data-testid="wallet-card-explorer"]')?.getAttribute('href')).toBe(
      getEtherscanLink(1, ADDRESS, 'address')
    );
    expect(drawer.querySelector('[data-testid="wallet-drawer-network"]')).toBeTruthy();
  });

  it('shows the total supplied USD value', async () => {
    renderDrawer();
    const drawer = await openDrawer();

    expect(drawer.querySelector('[data-testid="wallet-drawer-total"]')?.textContent).toContain('4,605.2');
  });

  it('disconnects via the drawer action', async () => {
    renderDrawer();
    const drawer = await openDrawer();

    fireEvent.click(drawer.querySelector('[data-testid="wallet-drawer-disconnect"]')!);
    expect(mocks.disconnect).toHaveBeenCalledTimes(1);
  });

  it('hides the disconnect action for Safe wallets', async () => {
    mocks.isSafeWallet = true;
    renderDrawer();
    const drawer = await openDrawer();

    expect(drawer.querySelector('[data-testid="wallet-drawer-disconnect"]')).toBeNull();
  });

  it('shows the Assets tab (shared balances component) by default and switches to Activity', async () => {
    renderDrawer();
    const drawer = await openDrawer();

    expect(drawer.querySelector('[data-testid="modules-balances-stub"]')).toBeTruthy();
    expect(drawer.querySelector('[data-testid="balances-history-stub"]')).toBeNull();

    // Radix tabs activate on mousedown, not click.
    fireEvent.mouseDown(drawer.querySelector('[data-testid="wallet-drawer-tab-activity"]')!, {
      button: 0
    });

    expect(drawer.querySelector('[data-testid="balances-history-stub"]')).toBeTruthy();
    expect(drawer.querySelector('[data-testid="modules-balances-stub"]')).toBeNull();

    fireEvent.mouseDown(drawer.querySelector('[data-testid="wallet-drawer-tab-assets"]')!, { button: 0 });
    expect(drawer.querySelector('[data-testid="modules-balances-stub"]')).toBeTruthy();
  });

  it('closes when a navigation happens', async () => {
    renderDrawer();
    await openDrawer();

    await act(async () => {
      await lastRouter!.navigate({ to: '/earn/savings' });
    });

    expect(screen.queryByTestId('wallet-drawer')).toBeNull();
  });
});
