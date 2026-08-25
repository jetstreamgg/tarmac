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
    authData: undefined as { authIsLoading?: boolean } | undefined,
    vpnData: undefined as { vpnIsLoading?: boolean } | undefined,
    isCheckingTerms: false
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
    vpnData: undefined,
    isCheckingTerms: false
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

// The two connect-time checks run back to back and used to raise a "Please
// wait" card each. One cover spans both, and it lives here because this is the
// only component that owns both gates — UnauthorizedPage also mounts inside
// AuthWrapper, so a cover in it would put two scrims on screen at once.
describe('WalletChip connect-checks cover', () => {
  it('covers the screen while address screening is in flight', async () => {
    mocks.connectedContext.isAuthorized = false;
    mocks.connectedContext.authData = { authIsLoading: true };
    renderWalletChip();

    await screen.findByTestId('connect-checks-cover');
  });

  it('stays up for the terms check that follows, without a gap', async () => {
    mocks.connectedContext.isAuthorized = true;
    mocks.connectedContext.isCheckingTerms = true;
    renderWalletChip();

    await screen.findByTestId('connect-checks-cover');
  });

  it('is a modal dialog, so the page behind the blur is inert', async () => {
    mocks.connectedContext.isCheckingTerms = true;
    renderWalletChip();

    const cover = await screen.findByTestId('connect-checks-cover');
    expect(cover.getAttribute('role')).toBe('dialog');
    // Radix's modal lock, which a bare fixed layer does not get: the page
    // behind the blur stops taking pointer events. The check can run for
    // seconds — checkTermsWithRetry retries twice.
    expect(document.body.style.pointerEvents).toBe('none');
    // Announced on open the way the old waiting card's title was.
    expect(cover.textContent).toContain('Checking whether you can use Sky.money');
  });

  // Pointer-events only stops the mouse. The keyboard is held by FocusScope,
  // and it arms itself from whatever it focused on mount — so a cover with no
  // focusable children that also suppressed auto-focus would leave the trap
  // dormant and Tab would walk the nav under the frost.
  it('holds keyboard focus, so the page behind the blur cannot be tabbed into', async () => {
    mocks.connectedContext.isCheckingTerms = true;
    renderWalletChip();

    const cover = await screen.findByTestId('connect-checks-cover');
    expect(cover.contains(document.activeElement)).toBe(true);

    // Whatever Tab would have reached: focusing it must bounce straight back.
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    outside.focus();

    expect(cover.contains(document.activeElement)).toBe(true);
    outside.remove();
  });

  // The two checks disagree on when they are done: the terms check fires on
  // address screening alone, while a region block comes from the VPN query. A
  // clean address in a restricted region hits both at once, and the cover must
  // not land on top of the Access-blocked dialog.
  it('stays down for a blocked user whose terms check is still running', async () => {
    mocks.connectedContext.isAuthorized = false;
    mocks.connectedContext.isCheckingTerms = true;
    mocks.connectedContext.authData = { authIsLoading: false };
    mocks.connectedContext.vpnData = { vpnIsLoading: false };
    renderWalletChip();

    await screen.findByTestId('unauthorized-page-stub');
    expect(screen.queryByTestId('connect-checks-cover')).toBeNull();
  });

  it('does not cover the app for a background re-check once terms are accepted', async () => {
    mocks.connectedContext.isConnectedAndAcceptedTerms = true;
    mocks.connectedContext.isCheckingTerms = true;
    mocks.connection = { isConnected: true, address: ADDRESS, connector: undefined };
    renderWalletChip();

    await screen.findByTestId('wallet-chip');
    expect(screen.queryByTestId('connect-checks-cover')).toBeNull();
  });

  it('leaves the app alone when no check is running', async () => {
    renderWalletChip();

    await screen.findByTestId('wallet-chip');
    expect(screen.queryByTestId('connect-checks-cover')).toBeNull();
  });
});
