import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  Outlet,
  RouterProvider
} from '@tanstack/react-router';
import { I18nWidgetProvider } from '@/widgets/context/I18nWidgetProvider';
import { WalletChip } from './WalletChip';

const ADDRESS = '0x1234567890abcdef1234567890abcdef12345678';

const mocks = vi.hoisted(() => ({
  connection: { isConnected: false, address: undefined as string | undefined, connector: undefined },
  connectedContext: {
    isConnectedAndAcceptedTerms: false,
    isAuthorized: true,
    authData: undefined,
    vpnData: undefined
  },
  ensName: undefined as string | undefined,
  isSafeWallet: false,
  openConnectModal: vi.fn(),
  disconnect: vi.fn()
}));

vi.mock('wagmi', async importOriginal => {
  const actual = await importOriginal<typeof import('wagmi')>();
  return {
    ...actual,
    useConnection: () => mocks.connection,
    useDisconnect: () => ({ disconnect: mocks.disconnect }),
    useEnsName: () => ({ data: mocks.ensName }),
    useEnsAvatar: () => ({ data: undefined })
  };
});

vi.mock('@/hooks', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks')>();
  return { ...actual, useIsSafeWallet: () => mocks.isSafeWallet };
});

vi.mock('@/modules/ui/context/ConnectedContext', async importOriginal => {
  const actual = await importOriginal<typeof import('@/modules/ui/context/ConnectedContext')>();
  return { ...actual, useConnectedContext: () => mocks.connectedContext };
});

vi.mock('@/modules/ui/context/ConnectModalContext', async importOriginal => {
  const actual = await importOriginal<typeof import('@/modules/ui/context/ConnectModalContext')>();
  return { ...actual, useConnectModal: () => ({ openConnectModal: mocks.openConnectModal }) };
});

// Gate components are opaque to the chip: their behavior has its own coverage.
vi.mock('@/modules/ui/components/TermsModal', () => ({
  TermsModal: () => <div data-testid="terms-modal-stub" />
}));

vi.mock('@/modules/auth/components/UnauthorizedPage', () => ({
  UnauthorizedPage: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="unauthorized-page-stub">{children}</div>
  )
}));

vi.mock('@/modules/ui/components/Avatar', () => ({
  CustomAvatar: () => <div data-testid="avatar-stub" />
}));

vi.mock('./WalletPreviewDrawer', () => ({
  WalletPreviewDrawer: ({ isOpen }: { isOpen: boolean }) => (
    <div data-testid="wallet-drawer-stub" data-open={String(isOpen)} />
  )
}));

beforeEach(() => {
  mocks.connection = { isConnected: false, address: undefined, connector: undefined };
  mocks.connectedContext = {
    isConnectedAndAcceptedTerms: false,
    isAuthorized: true,
    authData: undefined,
    vpnData: undefined
  };
  mocks.ensName = undefined;
  mocks.isSafeWallet = false;
  mocks.openConnectModal.mockClear();
  mocks.disconnect.mockClear();
});

function renderWalletChip() {
  const rootRoute = createRootRoute({
    component: () => (
      <>
        <WalletChip />
        <Outlet />
      </>
    )
  });
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ['/'] })
  });

  render(
    <I18nWidgetProvider locale="en">
      <RouterProvider router={router as never} />
    </I18nWidgetProvider>
  );
  return router;
}

describe('WalletChip render ladder', () => {
  it('renders the terms gate while terms are not accepted (the gate owns its connect trigger)', async () => {
    renderWalletChip();

    const chip = await screen.findByTestId('wallet-chip');
    expect(chip.querySelector('[data-testid="terms-modal-stub"]')).toBeTruthy();
  });

  it('offers Connect Wallet once terms are accepted but the wallet is disconnected', async () => {
    mocks.connectedContext.isConnectedAndAcceptedTerms = true;
    renderWalletChip();

    const chip = await screen.findByTestId('wallet-chip');
    const connectButton = chip.querySelector('button');
    expect(connectButton?.textContent).toMatch(/Connect Wallet/);

    fireEvent.click(connectButton!);
    expect(mocks.openConnectModal).toHaveBeenCalledTimes(1);
  });

  it('shows the truncated address when connected', async () => {
    mocks.connectedContext.isConnectedAndAcceptedTerms = true;
    mocks.connection = { isConnected: true, address: ADDRESS, connector: undefined };
    renderWalletChip();

    const chip = await screen.findByTestId('wallet-chip');
    expect(chip.textContent).toContain('0x1234...5678');
    expect(chip.querySelector('[data-testid="avatar-stub"]')).toBeTruthy();
  });

  it('prefers the ENS name and prefixes safe: for Safe wallets', async () => {
    mocks.connectedContext.isConnectedAndAcceptedTerms = true;
    mocks.connection = { isConnected: true, address: ADDRESS, connector: undefined };
    mocks.ensName = 'bartoo.eth';
    mocks.isSafeWallet = true;
    renderWalletChip();

    const chip = await screen.findByTestId('wallet-chip');
    expect(chip.textContent).toContain('safe:bartoo.eth');
  });

  it('opens the wallet preview drawer when the connected chip is clicked', async () => {
    mocks.connectedContext.isConnectedAndAcceptedTerms = true;
    mocks.connection = { isConnected: true, address: ADDRESS, connector: undefined };
    renderWalletChip();

    const chip = await screen.findByTestId('wallet-chip');
    expect(screen.getByTestId('wallet-drawer-stub').getAttribute('data-open')).toBe('false');

    fireEvent.click(chip.querySelector('button')!);
    expect(screen.getByTestId('wallet-drawer-stub').getAttribute('data-open')).toBe('true');
  });

  it('defers to the UnauthorizedPage gate when not authorized', async () => {
    mocks.connectedContext.isAuthorized = false;
    renderWalletChip();

    const gate = await screen.findByTestId('unauthorized-page-stub');
    expect(gate.querySelector('button')?.textContent).toMatch(/Connect Wallet/);
  });
});
