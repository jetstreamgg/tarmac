import { renderHook, render, act, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { GateControls } from '@/modules/ui/context/preTransactionGate';

const ADDRESS = '0x1234567890123456789012345678901234567890';
const FOUR_HOURS = 4 * 60 * 60 * 1000;

const mocks = vi.hoisted(() => ({
  shouldSkipAuthChecks: vi.fn(() => false),
  wagmiAddress: '0x1234567890123456789012345678901234567890' as string | undefined,
  fetchAddressScreening: vi.fn(),
  signTerms: vi.fn(async () => true),
  retryTermsCheck: vi.fn(),
  retryAccessChecks: vi.fn(),
  connected: {
    hasSignedCurrentTerms: false,
    termsMessageToSign: 'By signing this message...' as string | undefined,
    isUsUser: undefined as boolean | undefined,
    vpnData: { isConnectedToVpn: undefined as boolean | undefined, vpnIsLoading: false }
  }
}));

vi.mock('@/lib/authCheck', () => ({
  shouldSkipAuthChecks: mocks.shouldSkipAuthChecks,
  getAuthUrl: () => 'https://auth.test'
}));

vi.mock('@/hooks', async io => ({
  ...(await io<typeof import('@/hooks')>()),
  fetchAddressScreening: mocks.fetchAddressScreening
}));

vi.mock('wagmi', async io => ({
  ...(await io<typeof import('wagmi')>()),
  useConnection: () => ({ address: mocks.wagmiAddress, isConnected: !!mocks.wagmiAddress }),
  useDisconnect: () => ({ disconnect: vi.fn() })
}));

vi.mock('@/modules/ui/context/ConnectedContext', () => ({
  useConnectedContext: () => ({
    ...mocks.connected,
    signTerms: mocks.signTerms,
    retryTermsCheck: mocks.retryTermsCheck,
    retryAccessChecks: mocks.retryAccessChecks
  })
}));

import { addressScreeningQueryKey } from '@/hooks';
import { useTermsSignatureGate } from './useTermsSignatureGate';

i18n.load('en', {});
i18n.activate('en');

let queryClient: QueryClient;

const wrapper = ({ children }: { children: ReactNode }) => (
  <I18nProvider i18n={i18n}>
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  </I18nProvider>
);

const makeControls = () => ({
  setGateStatus: vi.fn<GateControls['setGateStatus']>(),
  setPreludeSteps: vi.fn<GateControls['setPreludeSteps']>(),
  closeModal: vi.fn<GateControls['closeModal']>(),
  isStale: vi.fn<GateControls['isStale']>(() => false)
});

/** Seeds the shared screening cache. `ageMs` past means stale for the gate. */
const seedScreening = (addressAllowed: boolean, ageMs = 0) => {
  queryClient.setQueryData(
    addressScreeningQueryKey(ADDRESS),
    { addressAllowed },
    { updatedAt: Date.now() - ageMs }
  );
};

const renderGate = () => renderHook(() => useTermsSignatureGate(), { wrapper }).result.current;

describe('useTermsSignatureGate', () => {
  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, retryDelay: 0 } }
    });
    mocks.wagmiAddress = ADDRESS;
    mocks.connected.hasSignedCurrentTerms = false;
    mocks.connected.termsMessageToSign = 'By signing this message...';
    mocks.connected.isUsUser = undefined;
    mocks.connected.vpnData = { isConnectedToVpn: undefined, vpnIsLoading: false };
  });
  afterEach(() => vi.clearAllMocks());

  it('the dev/e2e bypass allows synchronously without touching anything', () => {
    mocks.shouldSkipAuthChecks.mockReturnValue(true);
    const { gate } = renderGate();
    const controls = makeControls();

    const verdict = gate({ trigger: 'confirm', controls });

    expect(verdict).toEqual({ allow: true });
    expect(controls.setGateStatus).not.toHaveBeenCalled();
    expect(mocks.fetchAddressScreening).not.toHaveBeenCalled();
    mocks.shouldSkipAuthChecks.mockReturnValue(false);
  });

  it('fresh screening + non-US non-VPN: synchronous allow, no added step', () => {
    seedScreening(true);
    mocks.connected.isUsUser = false;
    mocks.connected.vpnData.isConnectedToVpn = false;
    const { gate } = renderGate();
    const controls = makeControls();

    const verdict = gate({ trigger: 'confirm', controls });

    expect(verdict).toEqual({ allow: true });
    // The prelude is cleared, never set — and no status was driven.
    expect(controls.setPreludeSteps).toHaveBeenCalledWith(null);
    expect(controls.setGateStatus).not.toHaveBeenCalled();
    expect(mocks.signTerms).not.toHaveBeenCalled();
  });

  it('fresh screening + US user already signed: synchronous allow, no added step', () => {
    seedScreening(true);
    mocks.connected.isUsUser = true;
    mocks.connected.vpnData.isConnectedToVpn = false;
    mocks.connected.hasSignedCurrentTerms = true;
    const { gate } = renderGate();
    const controls = makeControls();

    expect(gate({ trigger: 'confirm', controls })).toEqual({ allow: true });
    expect(mocks.signTerms).not.toHaveBeenCalled();
  });

  it('US user without a signature: mounts the signature step, signs, then allows', async () => {
    seedScreening(true);
    mocks.connected.isUsUser = true;
    mocks.connected.vpnData.isConnectedToVpn = false;
    const { gate } = renderGate();
    const controls = makeControls();

    const verdict = gate({ trigger: 'confirm', controls });
    expect(verdict).toBeInstanceOf(Promise);
    expect(controls.setPreludeSteps).toHaveBeenCalledWith([expect.objectContaining({ kind: 'signature' })]);
    const statuses = () => controls.setGateStatus.mock.calls.map(([status]) => status);
    expect(statuses()).toContain('initialized');

    await expect(verdict).resolves.toEqual({ allow: true });
    expect(mocks.signTerms).toHaveBeenCalledTimes(1);
    // INITIALIZED stays standing for onMutate to advance past the step.
    expect(statuses()).not.toContain('error');
    expect(statuses()).not.toContain('idle');
  });

  it('a VPN user owes the signature even outside the US', async () => {
    seedScreening(true);
    mocks.connected.isUsUser = false;
    mocks.connected.vpnData.isConnectedToVpn = true;
    const { gate } = renderGate();

    await expect(gate({ trigger: 'confirm', controls: makeControls() })).resolves.toEqual({
      allow: true
    });
    expect(mocks.signTerms).toHaveBeenCalled();
  });

  it('an unknown location counts as US/VPN: the signature is required', async () => {
    seedScreening(true);
    // isUsUser and isConnectedToVpn both undefined (check unresolved).
    const { gate } = renderGate();

    await expect(gate({ trigger: 'confirm', controls: makeControls() })).resolves.toEqual({
      allow: true
    });
    expect(mocks.signTerms).toHaveBeenCalled();
  });

  it('a rejected or failed signature denies and drives the failed step', async () => {
    seedScreening(true);
    mocks.connected.isUsUser = true;
    mocks.connected.vpnData.isConnectedToVpn = false;
    mocks.signTerms.mockResolvedValueOnce(false);
    const { gate } = renderGate();
    const controls = makeControls();

    await expect(gate({ trigger: 'confirm', controls })).resolves.toEqual({ allow: false });
    expect(controls.setGateStatus.mock.calls.at(-1)?.[0]).toBe('error');
  });

  it('a missing messageToSign fails the step without signing, and kicks the terms check', async () => {
    seedScreening(true);
    mocks.connected.isUsUser = true;
    mocks.connected.vpnData.isConnectedToVpn = false;
    mocks.connected.termsMessageToSign = undefined;
    const { gate } = renderGate();
    const controls = makeControls();

    await expect(gate({ trigger: 'confirm', controls })).resolves.toEqual({ allow: false });
    expect(mocks.signTerms).not.toHaveBeenCalled();
    expect(mocks.retryTermsCheck).toHaveBeenCalledTimes(1);
    expect(controls.setGateStatus.mock.calls.at(-1)?.[0]).toBe('error');
  });

  it('a fresh risky verdict denies synchronously and closes the modal', () => {
    seedScreening(false);
    const { gate } = renderGate();
    const controls = makeControls();

    expect(gate({ trigger: 'confirm', controls })).toEqual({ allow: false });
    expect(controls.closeModal).toHaveBeenCalledTimes(1);
    expect(mocks.signTerms).not.toHaveBeenCalled();
  });

  it('a stale verdict re-screens; allowed + no signature owed resets the status to idle before allowing', async () => {
    seedScreening(true, FOUR_HOURS + 1);
    mocks.connected.isUsUser = false;
    mocks.connected.vpnData.isConnectedToVpn = false;
    mocks.fetchAddressScreening.mockResolvedValueOnce({ addressAllowed: true });
    const { gate } = renderGate();
    const controls = makeControls();

    const verdict = gate({ trigger: 'confirm', controls });
    expect(verdict).toBeInstanceOf(Promise);
    expect(controls.setGateStatus.mock.calls[0][0]).toBe('initialized');

    await expect(verdict).resolves.toEqual({ allow: true });
    expect(mocks.fetchAddressScreening).toHaveBeenCalledTimes(1);
    // Handed back to IDLE so the engine's onMutate doesn't advance past a
    // prelude step that was never mounted.
    expect(controls.setGateStatus.mock.calls.at(-1)?.[0]).toBe('idle');
  });

  it('a re-screen finding the address risky denies and closes the modal', async () => {
    seedScreening(true, FOUR_HOURS + 1);
    mocks.fetchAddressScreening.mockResolvedValueOnce({ addressAllowed: false });
    const { gate } = renderGate();
    const controls = makeControls();

    await expect(gate({ trigger: 'confirm', controls })).resolves.toEqual({ allow: false });
    expect(controls.closeModal).toHaveBeenCalledTimes(1);
  });

  it('a failed re-screen fails closed', async () => {
    queryClient.removeQueries();
    mocks.fetchAddressScreening.mockRejectedValue(new Error('screening down'));
    const { gate } = renderGate();
    const controls = makeControls();

    await expect(gate({ trigger: 'confirm', controls })).resolves.toEqual({ allow: false });
    expect(controls.closeModal).toHaveBeenCalledTimes(1);
    expect(mocks.signTerms).not.toHaveBeenCalled();
  });

  it('a failed re-screen over a stale cached verdict surfaces the gate-owned dialog', async () => {
    seedScreening(true, FOUR_HOURS + 1);
    mocks.fetchAddressScreening.mockRejectedValue(new Error('screening down'));

    // Render a host so the dialog actually mounts.
    let gateRef!: ReturnType<typeof useTermsSignatureGate>;
    const Host = () => {
      gateRef = useTermsSignatureGate();
      return <>{gateRef.screeningDialog}</>;
    };
    render(<Host />, { wrapper });
    const controls = makeControls();

    await act(async () => {
      await expect(gateRef.gate({ trigger: 'confirm', controls })).resolves.toEqual({
        allow: false
      });
    });

    expect(screen.getByText(/unable to verify this wallet/i)).not.toBeNull();
    // "Check again" re-runs the access checks and dismisses.
    fireEvent.click(screen.getByRole('button', { name: /check again/i }));
    expect(mocks.retryAccessChecks).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/unable to verify this wallet/i)).toBeNull();
  });

  it('the screening-failure dialog clears when the address changes', async () => {
    seedScreening(true, FOUR_HOURS + 1);
    mocks.fetchAddressScreening.mockRejectedValue(new Error('screening down'));

    let gateRef!: ReturnType<typeof useTermsSignatureGate>;
    const Host = () => {
      gateRef = useTermsSignatureGate();
      return <>{gateRef.screeningDialog}</>;
    };
    const { rerender } = render(<Host />, { wrapper });

    await act(async () => {
      await gateRef.gate({ trigger: 'confirm', controls: makeControls() });
    });
    expect(screen.getByText(/unable to verify this wallet/i)).not.toBeNull();

    mocks.wagmiAddress = '0x0987654321098765432109876543210987654321';
    rerender(<Host />);

    expect(screen.queryByText(/unable to verify this wallet/i)).toBeNull();
  });

  it('an address switch during the re-screen denies — the old verdict never carries over', async () => {
    seedScreening(true, FOUR_HOURS + 1);
    mocks.connected.isUsUser = false;
    mocks.connected.vpnData.isConnectedToVpn = false;
    let resolveFetch!: (v: { addressAllowed: boolean }) => void;
    mocks.fetchAddressScreening.mockReturnValue(new Promise(resolve => (resolveFetch = resolve)));

    let gateRef!: ReturnType<typeof useTermsSignatureGate>;
    const Host = () => {
      gateRef = useTermsSignatureGate();
      return null;
    };
    const { rerender } = render(<Host />, { wrapper });
    const controls = makeControls();

    const verdict = gateRef.gate({ trigger: 'confirm', controls }) as Promise<{ allow: boolean }>;
    // Wallet switches while the fetch is in flight.
    mocks.wagmiAddress = '0x0987654321098765432109876543210987654321';
    rerender(<Host />);
    resolveFetch({ addressAllowed: true });

    await expect(verdict).resolves.toEqual({ allow: false });
    expect(mocks.signTerms).not.toHaveBeenCalled();
  });

  it('a stale session stops the run before the wallet is ever prompted', async () => {
    seedScreening(true);
    mocks.connected.isUsUser = true;
    mocks.connected.vpnData.isConnectedToVpn = false;
    const { gate } = renderGate();
    const controls = makeControls();
    // The session ends (close/relaunch) before the signature phase starts.
    controls.isStale.mockReturnValue(true);

    await expect(gate({ trigger: 'confirm', controls })).resolves.toEqual({ allow: false });
    expect(mocks.signTerms).not.toHaveBeenCalled();
  });

  it('async denials hand the status back to idle before closing (no abandoned-prompt toast)', async () => {
    seedScreening(true, FOUR_HOURS + 1);
    mocks.fetchAddressScreening.mockResolvedValueOnce({ addressAllowed: false });
    const { gate } = renderGate();
    const controls = makeControls();

    await expect(gate({ trigger: 'confirm', controls })).resolves.toEqual({ allow: false });

    // setGateStatus('idle') must land before closeModal, so handleClose reads
    // IDLE instead of the pending INITIALIZED.
    const idleCall = controls.setGateStatus.mock.calls.findIndex(([status]) => status === 'idle');
    expect(idleCall).toBeGreaterThan(-1);
    const idleOrder = controls.setGateStatus.mock.invocationCallOrder[idleCall];
    expect(controls.closeModal).toHaveBeenCalledTimes(1);
    expect(idleOrder).toBeLessThan(controls.closeModal.mock.invocationCallOrder[0]);
  });

  it('gate statuses carry their own copy: screening and signature phases override the flow copy', async () => {
    seedScreening(true, FOUR_HOURS + 1);
    mocks.connected.isUsUser = true;
    mocks.connected.vpnData.isConnectedToVpn = false;
    mocks.fetchAddressScreening.mockResolvedValueOnce({ addressAllowed: true });
    mocks.signTerms.mockResolvedValueOnce(false);
    const { gate } = renderGate();
    const controls = makeControls();

    await expect(gate({ trigger: 'confirm', controls })).resolves.toEqual({ allow: false });

    const copyOf = (status: string) => controls.setGateStatus.mock.calls.find(([s]) => s === status)?.[1];
    expect(copyOf('initialized')).toBeDefined(); // screening copy on the re-screen
    expect(copyOf('error')?.subtitle).toBeTruthy(); // gate-owned failure subtitle
  });
});
