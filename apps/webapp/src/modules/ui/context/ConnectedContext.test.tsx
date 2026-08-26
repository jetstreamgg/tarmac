import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { termsAcceptanceKey } from '@/modules/ui/lib/termsAcceptanceStorage';

/**
 * The terms gate is an AND of a localStorage flag and the DB's `accepted`
 * boolean (APP-499). These tests pin both halves, since either one alone is a
 * hole the feature exists to close: a DB row proves someone accepted for this
 * address, not that *this browser* ever showed the terms to its owner.
 *
 * Scaffolding adapted from PR #1690 (APP-330), which is closed.
 */

const ADDRESS_A = '0x1234567890123456789012345678901234567890';
const ADDRESS_B = '0x0987654321098765432109876543210987654321';
// The numeric identity the local flag is keyed by, and the date shown beside
// it. Separate values on purpose: nothing derives one from the other.
const VERSION = '1.0';
const EFFECTIVE_DATE = '2026-01-15';

// Shared spies/state between the mocks and assertions.
const mocks = vi.hoisted(() => ({
  checkTermsWithRetry: vi.fn(),
  addTermsAcceptance: vi.fn(),
  signTermsAcceptance: vi.fn(),
  signMessageAsync: vi.fn(),
  trackVpnCheckCompleted: vi.fn(),
  reportError: vi.fn(),
  isPrivateDeployment: vi.fn(() => false),
  address: '0x1234567890123456789012345678901234567890' as string | undefined,
  authCheck: {
    data: { addressAllowed: true } as { addressAllowed: boolean } | undefined,
    isLoading: false,
    error: undefined as Error | undefined
  },
  vpnCheck: {
    data: { isConnectedToVpn: false, isRestrictedRegion: false, countryCode: 'US' } as
      { isConnectedToVpn: boolean; isRestrictedRegion: boolean; countryCode: string } | undefined,
    isLoading: false,
    error: undefined as Error | undefined
  },
  refetchAddressCheck: vi.fn(),
  refetchVpnCheck: vi.fn()
}));

vi.mock('wagmi', async importOriginal => {
  const actual = await importOriginal<typeof import('wagmi')>();
  return {
    ...actual,
    useChainId: () => 1,
    useConnection: () => ({
      isConnected: !!mocks.address,
      address: mocks.address,
      chainId: 1,
      connector: { name: 'mock' }
    }),
    useSignMessage: () => ({ signMessageAsync: mocks.signMessageAsync })
  };
});

vi.mock('@/hooks', () => ({
  useRestrictedAddressCheck: () => ({ ...mocks.authCheck, refetch: mocks.refetchAddressCheck }),
  useVpnCheck: () => ({ ...mocks.vpnCheck, refetch: mocks.refetchVpnCheck }),
  toError: (error: unknown) => (error instanceof Error ? error : new Error(String(error)))
}));

vi.mock('@/lib/isPrivateDeployment', () => ({
  isPrivateDeployment: () => mocks.isPrivateDeployment()
}));

vi.mock('@/modules/analytics/hooks/useVpnAnalytics', () => ({
  useVpnAnalytics: () => ({ trackVpnCheckCompleted: mocks.trackVpnCheckCompleted })
}));

vi.mock('@/modules/sentry/reportError', () => ({
  reportError: mocks.reportError
}));

vi.mock('@/modules/ui/lib/checkTermsWithRetry', () => ({
  checkTermsWithRetry: mocks.checkTermsWithRetry
}));

vi.mock('@/modules/ui/lib/addTermsAcceptance', () => ({
  addTermsAcceptance: mocks.addTermsAcceptance
}));

vi.mock('@/modules/ui/lib/signTermsAcceptance', () => ({
  signTermsAcceptance: mocks.signTermsAcceptance
}));

import { ConnectedProvider, useConnectedContext } from './ConnectedContext';

function Consumer() {
  const {
    hasAcceptedTerms,
    hasSignedCurrentTerms,
    isConnectedAndAcceptedTerms,
    isAuthorized,
    accessBlockReason,
    isUsUser,
    latestTermsVersion,
    termsMessageToSign,
    termsCheckDenied,
    isCheckingTerms,
    acceptTerms,
    signTerms,
    retryAccessChecks
  } = useConnectedContext();
  return (
    <div>
      <span data-testid="accepted">{String(hasAcceptedTerms)}</span>
      <span data-testid="browsing">{String(isConnectedAndAcceptedTerms)}</span>
      <span data-testid="signed">{String(hasSignedCurrentTerms)}</span>
      <span data-testid="authorized">{String(isAuthorized)}</span>
      <span data-testid="block-reason">{accessBlockReason ?? 'none'}</span>
      <span data-testid="is-us">{String(isUsUser)}</span>
      <span data-testid="version">{latestTermsVersion ?? 'none'}</span>
      <span data-testid="message">{termsMessageToSign ?? 'none'}</span>
      <span data-testid="denied">{String(termsCheckDenied)}</span>
      <span data-testid="checking">{String(isCheckingTerms)}</span>
      <button data-testid="accept" onClick={() => void acceptTerms()}>
        accept
      </button>
      <button data-testid="sign" onClick={() => void signTerms()}>
        sign
      </button>
      <button data-testid="retry-access" onClick={retryAccessChecks}>
        retry
      </button>
    </div>
  );
}

/** A `/check` outcome in the current contract. */
const checkResult = (overrides: Record<string, unknown> = {}) => ({
  status: 'ok' as const,
  accepted: true,
  signedForCurrentVersion: false,
  latestVersion: VERSION,
  effectiveDate: EFFECTIVE_DATE,
  messageToSign: 'By signing this message...',
  ...overrides
});

const renderProvider = () =>
  render(
    <ConnectedProvider>
      <Consumer />
    </ConnectedProvider>
  );

const accepted = () => screen.getByTestId('accepted').textContent;

describe('ConnectedContext — the terms AND gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mocks.address = ADDRESS_A;
    mocks.isPrivateDeployment.mockReturnValue(false);
    mocks.checkTermsWithRetry.mockResolvedValue(checkResult());
    mocks.addTermsAcceptance.mockResolvedValue({ ok: true });
    mocks.signTermsAcceptance.mockResolvedValue({ ok: true });
    mocks.signMessageAsync.mockResolvedValue('0xsignature');
    mocks.authCheck = { data: { addressAllowed: true }, isLoading: false, error: undefined };
    mocks.vpnCheck = {
      data: { isConnectedToVpn: false, isRestrictedRegion: false, countryCode: 'US' },
      isLoading: false,
      error: undefined
    };
    vi.stubEnv('VITE_SKIP_AUTH_CHECK', 'false');
    vi.stubEnv('VITE_USE_MOCK_WALLET', 'false');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('opens the gate when both halves are present', async () => {
    localStorage.setItem(termsAcceptanceKey(ADDRESS_A, VERSION), 'true');

    renderProvider();

    await waitFor(() => expect(accepted()).toBe('true'));
    expect(screen.getByTestId('browsing').textContent).toBe('true');
  });

  // The returning-user case: a DB row from another device or a cleared browser.
  it('re-prompts when the DB reports accepted but this browser has no flag', async () => {
    renderProvider();

    await waitFor(() => expect(screen.getByTestId('version').textContent).toBe(VERSION));
    expect(accepted()).toBe('false');
  });

  it('re-prompts when the flag is present but the DB has no row', async () => {
    localStorage.setItem(termsAcceptanceKey(ADDRESS_A, VERSION), 'true');
    mocks.checkTermsWithRetry.mockResolvedValue(checkResult({ accepted: false }));

    renderProvider();

    await waitFor(() => expect(screen.getByTestId('version').textContent).toBe(VERSION));
    expect(accepted()).toBe('false');
  });

  it('re-prompts when neither half is present', async () => {
    mocks.checkTermsWithRetry.mockResolvedValue(checkResult({ accepted: false }));

    renderProvider();

    await waitFor(() => expect(screen.getByTestId('version').textContent).toBe(VERSION));
    expect(accepted()).toBe('false');
  });

  // The impersonation case the local half exists for: B already has a DB row,
  // but this browser never showed B's owner the terms.
  it('re-prompts after switching to a second address that already has a DB row', async () => {
    localStorage.setItem(termsAcceptanceKey(ADDRESS_A, VERSION), 'true');

    const { rerender } = renderProvider();
    await waitFor(() => expect(accepted()).toBe('true'));

    mocks.address = ADDRESS_B;
    rerender(
      <ConnectedProvider>
        <Consumer />
      </ConnectedProvider>
    );

    await waitFor(() => expect(accepted()).toBe('false'));
  });

  it('re-prompts after a terms version bump', async () => {
    localStorage.setItem(termsAcceptanceKey(ADDRESS_A, VERSION), 'true');
    mocks.checkTermsWithRetry.mockResolvedValue(checkResult({ latestVersion: '2.0' }));

    renderProvider();

    await waitFor(() => expect(screen.getByTestId('version').textContent).toBe('2.0'));
    expect(accepted()).toBe('false');
  });

  // A minor bump re-prompts exactly like a major one: the flag is keyed by the
  // whole version string and nothing compares parts of it.
  it('re-prompts after a MINOR version bump that keeps the effective date', async () => {
    localStorage.setItem(termsAcceptanceKey(ADDRESS_A, VERSION), 'true');
    mocks.checkTermsWithRetry.mockResolvedValue(
      checkResult({ latestVersion: '1.1', effectiveDate: EFFECTIVE_DATE })
    );

    renderProvider();

    await waitFor(() => expect(screen.getByTestId('version').textContent).toBe('1.1'));
    // The date is unchanged, so a date-keyed flag would still read as accepted
    // here — this is the collision the numeric identity exists to prevent.
    expect(accepted()).toBe('false');
  });

  it('exposes messageToSign for C6 without holding a copy of it', async () => {
    renderProvider();

    await waitFor(() => expect(screen.getByTestId('message').textContent).toBe('By signing this message...'));
  });

  describe('hasSignedCurrentTerms', () => {
    it('is false when the DB reports no signature for the current version', async () => {
      renderProvider();

      await waitFor(() => expect(screen.getByTestId('version').textContent).toBe(VERSION));
      expect(screen.getByTestId('signed').textContent).toBe('false');
    });

    // Signed and accepted are uncorrelated — a bump between the phases leaves a
    // signature for a version that was never accepted. Browsing stays gated.
    it('is true even when the browse gate is closed', async () => {
      mocks.checkTermsWithRetry.mockResolvedValue(
        checkResult({ accepted: false, signedForCurrentVersion: true })
      );

      renderProvider();

      await waitFor(() => expect(screen.getByTestId('signed').textContent).toBe('true'));
      expect(accepted()).toBe('false');
    });
  });

  describe('acceptTerms', () => {
    it('posts the acceptance and then opens the gate', async () => {
      renderProvider();
      await waitFor(() => expect(screen.getByTestId('version').textContent).toBe(VERSION));

      fireEvent.click(screen.getByTestId('accept'));

      await waitFor(() => expect(accepted()).toBe('true'));
      expect(mocks.addTermsAcceptance).toHaveBeenCalledWith(ADDRESS_A);
      expect(localStorage.getItem(termsAcceptanceKey(ADDRESS_A, VERSION))).toBe('true');
    });

    // Nothing is posted before the check reports a version: that row could
    // never be satisfied by any browser, since there would be no key to write
    // the local flag under.
    it('posts nothing before the version is known', async () => {
      mocks.checkTermsWithRetry.mockResolvedValue({ status: 'error', lastError: new Error('down') });

      renderProvider();
      await waitFor(() => expect(mocks.checkTermsWithRetry).toHaveBeenCalled());

      fireEvent.click(screen.getByTestId('accept'));

      await waitFor(() => expect(accepted()).toBe('false'));
      expect(mocks.addTermsAcceptance).not.toHaveBeenCalled();
    });

    // The ordering this feature turns on: a local flag written before a failed
    // DB write would leave the user browsing with no record anywhere.
    it('writes no local flag when the DB write fails', async () => {
      mocks.addTermsAcceptance.mockResolvedValue({ ok: false, status: 500 });

      renderProvider();
      await waitFor(() => expect(screen.getByTestId('version').textContent).toBe(VERSION));

      fireEvent.click(screen.getByTestId('accept'));

      await waitFor(() => expect(mocks.reportError).toHaveBeenCalled());
      expect(localStorage.getItem(termsAcceptanceKey(ADDRESS_A, VERSION))).toBeNull();
      expect(accepted()).toBe('false');
    });
  });

  /**
   * Safari with "Block all cookies", locked-down enterprise profiles and some
   * webviews throw on every localStorage access. Before the session fallback
   * these users were locked out entirely: `/add` wrote its row, the flag write
   * failed silently, the gate stayed shut, and the modal reopened — appending
   * another acceptance event on every retry, with nothing in Sentry.
   */
  describe('when localStorage is blocked', () => {
    beforeEach(() => {
      const blocked = () => {
        throw new DOMException('The operation is insecure.', 'SecurityError');
      };
      vi.stubGlobal('localStorage', {
        getItem: blocked,
        setItem: blocked,
        removeItem: blocked,
        key: blocked,
        get length(): number {
          return blocked();
        }
      });
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('opens the gate after accepting, rather than looping', async () => {
      renderProvider();
      await waitFor(() => expect(screen.getByTestId('version').textContent).toBe(VERSION));
      expect(accepted()).toBe('false');

      fireEvent.click(screen.getByTestId('accept'));

      await waitFor(() => expect(accepted()).toBe('true'));
      // One acceptance, not one per retry.
      expect(mocks.addTermsAcceptance).toHaveBeenCalledTimes(1);
      expect(mocks.reportError).not.toHaveBeenCalled();
    });
  });

  describe('bypasses', () => {
    it('skipAuthCheck opens both halves without a check', async () => {
      vi.stubEnv('VITE_SKIP_AUTH_CHECK', 'true');
      vi.stubEnv('VITE_ENV_NAME', 'development');

      renderProvider();

      await waitFor(() => expect(accepted()).toBe('true'));
      expect(screen.getByTestId('signed').textContent).toBe('true');
      expect(mocks.checkTermsWithRetry).not.toHaveBeenCalled();
    });

    it('the mock wallet records acceptance without calling the endpoint', async () => {
      vi.stubEnv('VITE_USE_MOCK_WALLET', 'true');

      renderProvider();
      await waitFor(() => expect(screen.getByTestId('version').textContent).toBe(VERSION));

      fireEvent.click(screen.getByTestId('accept'));

      await waitFor(() => expect(accepted()).toBe('true'));
      expect(mocks.addTermsAcceptance).not.toHaveBeenCalled();
    });
  });

  /**
   * The access gate rework (APP-497): a VPN stopped being a wall — the
   * safeguard for VPN/US users is the per-transaction signature (C6) — while
   * restricted regions, blocked wallets and unavailable checks all stay
   * fail-closed, each with its own distinct reason.
   */
  describe('access gating (APP-497)', () => {
    const blockReason = () => screen.getByTestId('block-reason').textContent;
    const authorized = () => screen.getByTestId('authorized').textContent;

    it('authorizes a VPN user and still runs the terms flow', async () => {
      mocks.vpnCheck.data = { isConnectedToVpn: true, isRestrictedRegion: false, countryCode: 'US' };

      renderProvider();

      expect(authorized()).toBe('true');
      expect(blockReason()).toBe('none');
      // VPN users browse normally, so the browse gate (terms modal) applies.
      await waitFor(() => expect(mocks.checkTermsWithRetry).toHaveBeenCalledWith(ADDRESS_A));
    });

    it('reports a VPN as allowed, not blocked, to analytics', async () => {
      mocks.vpnCheck.data = { isConnectedToVpn: true, isRestrictedRegion: false, countryCode: 'US' };

      renderProvider();

      await waitFor(() =>
        expect(mocks.trackVpnCheckCompleted).toHaveBeenCalledWith(
          expect.objectContaining({ isVpn: true, result: 'allowed' })
        )
      );
    });

    it('still blocks a restricted region', () => {
      mocks.vpnCheck.data = { isConnectedToVpn: false, isRestrictedRegion: true, countryCode: 'XX' };

      renderProvider();

      expect(authorized()).toBe('false');
      expect(blockReason()).toBe('region-restricted');
    });

    it('blocks a screened-out wallet and never asks it for terms', async () => {
      mocks.authCheck.data = { addressAllowed: false };

      renderProvider();

      expect(authorized()).toBe('false');
      expect(blockReason()).toBe('wallet-blocked');
      // The flow puts screening before the T&C gate: a blocked wallet gets the
      // blocked screen, so nothing here should reach the terms endpoint.
      await waitFor(() => expect(mocks.trackVpnCheckCompleted).toHaveBeenCalled());
      expect(mocks.checkTermsWithRetry).not.toHaveBeenCalled();
    });

    it('holds the gate closed, without a block reason, while screening is in flight', () => {
      mocks.authCheck = { data: undefined, isLoading: true, error: undefined };

      renderProvider();

      expect(authorized()).toBe('false');
      expect(blockReason()).toBe('none');
      expect(mocks.checkTermsWithRetry).not.toHaveBeenCalled();
    });

    it('runs the terms check only after screening resolves in favor', async () => {
      mocks.authCheck = { data: undefined, isLoading: true, error: undefined };

      const { rerender } = renderProvider();
      expect(mocks.checkTermsWithRetry).not.toHaveBeenCalled();

      mocks.authCheck = { data: { addressAllowed: true }, isLoading: false, error: undefined };
      rerender(
        <ConnectedProvider>
          <Consumer />
        </ConnectedProvider>
      );

      await waitFor(() => expect(mocks.checkTermsWithRetry).toHaveBeenCalledWith(ADDRESS_A));
      expect(authorized()).toBe('true');
    });

    it('fails closed with a distinct state when screening is unavailable', () => {
      mocks.authCheck = { data: undefined, isLoading: false, error: new Error('screening down') };

      renderProvider();

      expect(authorized()).toBe('false');
      expect(blockReason()).toBe('screening-unavailable');
      expect(mocks.checkTermsWithRetry).not.toHaveBeenCalled();
    });

    it('keeps a cached screening approval through a failed refetch', () => {
      mocks.authCheck = {
        data: { addressAllowed: true },
        isLoading: false,
        error: new Error('refetch failed')
      };

      renderProvider();

      expect(authorized()).toBe('true');
      expect(blockReason()).toBe('none');
    });

    it('fails closed when /ip/status is unavailable with no cached verdict', () => {
      mocks.vpnCheck = { data: undefined, isLoading: false, error: new Error('ip status down') };

      renderProvider();

      expect(authorized()).toBe('false');
      expect(blockReason()).toBe('ip-check-unavailable');
    });

    it('keeps a cached /ip/status verdict through a failed refetch', () => {
      mocks.vpnCheck.error = new Error('refetch failed');

      renderProvider();

      expect(authorized()).toBe('true');
      expect(blockReason()).toBe('none');
    });

    it('retryAccessChecks re-runs both checks', () => {
      mocks.authCheck = { data: undefined, isLoading: false, error: new Error('screening down') };

      renderProvider();
      fireEvent.click(screen.getByTestId('retry-access'));

      expect(mocks.refetchVpnCheck).toHaveBeenCalled();
      expect(mocks.refetchAddressCheck).toHaveBeenCalled();
    });

    describe('isUsUser (for the C6 signature gate)', () => {
      it('is true for a US country code', () => {
        renderProvider();
        expect(screen.getByTestId('is-us').textContent).toBe('true');
      });

      it('is false for a non-US country code', () => {
        mocks.vpnCheck.data = { isConnectedToVpn: false, isRestrictedRegion: false, countryCode: 'DE' };
        renderProvider();
        expect(screen.getByTestId('is-us').textContent).toBe('false');
      });

      it('is undefined until /ip/status resolves', () => {
        mocks.vpnCheck = { data: undefined, isLoading: true, error: undefined };
        renderProvider();
        expect(screen.getByTestId('is-us').textContent).toBe('undefined');
      });
    });
  });

  // APP-534 review. The in-flight flag drives WalletChip's full-screen cover,
  // and that cover is modal — so a flag that never clears locks the app.
  describe('a check overtaken by a disconnect', () => {
    it('clears the in-flight flag instead of leaving the cover up forever', async () => {
      let settle: (result: unknown) => void = () => {};
      mocks.checkTermsWithRetry.mockReturnValue(
        new Promise(resolve => {
          settle = resolve;
        })
      );

      const { rerender } = renderProvider();
      await waitFor(() => expect(screen.getByTestId('checking').textContent).toBe('true'));

      // The disconnect lands while `/check` is still out. Its continuation now
      // returns at the stale-address guard, before it can clear the flag.
      mocks.address = undefined;
      rerender(
        <ConnectedProvider>
          <Consumer />
        </ConnectedProvider>
      );
      await act(async () => {
        settle(checkResult());
      });

      expect(screen.getByTestId('checking').textContent).toBe('false');
    });
  });

  describe('check failures', () => {
    it('keeps the gate closed and reports when the check errors', async () => {
      localStorage.setItem(termsAcceptanceKey(ADDRESS_A, VERSION), 'true');
      mocks.checkTermsWithRetry.mockResolvedValue({ status: 'error', lastError: new Error('boom') });

      renderProvider();

      await waitFor(() => expect(mocks.reportError).toHaveBeenCalled());
      expect(accepted()).toBe('false');
      expect(screen.getByTestId('version').textContent).toBe('none');
    });

    it('keeps the gate closed on an access denial without reporting an error', async () => {
      localStorage.setItem(termsAcceptanceKey(ADDRESS_A, VERSION), 'true');
      mocks.checkTermsWithRetry.mockResolvedValue({ status: 'access-denied' });

      renderProvider();

      // The denial gets its own state (APP-497 review): the worker refused an
      // address the client-side screening let through, and without the flag
      // the modal would render interactive terms whose accept can never
      // succeed — a "check your connection" loop with no way out.
      await waitFor(() => expect(screen.getByTestId('denied').textContent).toBe('true'));
      expect(accepted()).toBe('false');
      expect(mocks.reportError).not.toHaveBeenCalled();
    });

    // The acceptance POST has the same stale-continuation hazard the check
    // guards against: without the address guard, a POST that lands after an
    // account switch stamps `accepted` onto the NEW address's check and
    // writes the OLD address's local flag via the stale closure.
    it('discards an acceptance that lands after an address switch', async () => {
      let resolveAdd: (value: { ok: boolean }) => void = () => {};
      mocks.addTermsAcceptance.mockReturnValue(new Promise(resolve => (resolveAdd = resolve)));

      const { rerender } = renderProvider();
      await waitFor(() => expect(screen.getByTestId('version').textContent).toBe(VERSION));

      fireEvent.click(screen.getByTestId('accept'));

      mocks.address = ADDRESS_B;
      rerender(
        <ConnectedProvider>
          <Consumer />
        </ConnectedProvider>
      );
      await waitFor(() => expect(screen.getByTestId('version').textContent).toBe(VERSION));

      resolveAdd({ ok: true });
      // Let the stale continuation run to completion before asserting that it
      // changed nothing.
      await act(() => new Promise(resolve => setTimeout(resolve, 0)));

      expect(accepted()).toBe('false');
      expect(localStorage.getItem(termsAcceptanceKey(ADDRESS_A, VERSION))).toBeNull();
      expect(localStorage.getItem(termsAcceptanceKey(ADDRESS_B, VERSION))).toBeNull();
    });

    it('discards an acceptance that lands after a disconnect', async () => {
      let resolveAdd: (value: { ok: boolean }) => void = () => {};
      mocks.addTermsAcceptance.mockReturnValue(new Promise(resolve => (resolveAdd = resolve)));

      const { rerender } = renderProvider();
      await waitFor(() => expect(screen.getByTestId('version').textContent).toBe(VERSION));

      fireEvent.click(screen.getByTestId('accept'));

      mocks.address = undefined;
      rerender(
        <ConnectedProvider>
          <Consumer />
        </ConnectedProvider>
      );

      resolveAdd({ ok: true });
      await act(() => new Promise(resolve => setTimeout(resolve, 0)));

      expect(accepted()).toBe('false');
      expect(localStorage.getItem(termsAcceptanceKey(ADDRESS_A, VERSION))).toBeNull();
    });
  });

  describe('signTerms (Phase B, APP-501)', () => {
    const signed = () => screen.getByTestId('signed').textContent;

    it('signs the message from /check, posts it, then flips hasSignedCurrentTerms', async () => {
      renderProvider();
      await waitFor(() => expect(screen.getByTestId('message').textContent).not.toBe('none'));
      expect(signed()).toBe('false');

      fireEvent.click(screen.getByTestId('sign'));

      await waitFor(() => expect(signed()).toBe('true'));
      expect(mocks.signMessageAsync).toHaveBeenCalledWith({ message: 'By signing this message...' });
      expect(mocks.signTermsAcceptance).toHaveBeenCalledWith(ADDRESS_A, 1, '0xsignature');
    });

    it('a wallet rejection resolves false without posting — and without telemetry', async () => {
      mocks.signMessageAsync.mockRejectedValue(new Error('User rejected the request'));
      renderProvider();
      await waitFor(() => expect(screen.getByTestId('message').textContent).not.toBe('none'));

      fireEvent.click(screen.getByTestId('sign'));
      await act(() => new Promise(resolve => setTimeout(resolve, 0)));

      expect(mocks.signTermsAcceptance).not.toHaveBeenCalled();
      expect(signed()).toBe('false');
      expect(mocks.reportError).not.toHaveBeenCalled();
    });

    it('a non-rejection wallet failure resolves false AND reports — the user is blocked from transacting', async () => {
      mocks.signMessageAsync.mockRejectedValue(new Error('Method eth_sign is not supported'));
      renderProvider();
      await waitFor(() => expect(screen.getByTestId('message').textContent).not.toBe('none'));

      fireEvent.click(screen.getByTestId('sign'));
      await act(() => new Promise(resolve => setTimeout(resolve, 0)));

      expect(mocks.signTermsAcceptance).not.toHaveBeenCalled();
      expect(signed()).toBe('false');
      expect(mocks.reportError).toHaveBeenCalledTimes(1);
    });

    it('under the mock wallet: an address switch mid-sign is discarded like the real path', async () => {
      vi.stubEnv('VITE_USE_MOCK_WALLET', 'true');
      let resolveSign: (value: string) => void = () => {};
      mocks.signMessageAsync.mockReturnValue(new Promise(resolve => (resolveSign = resolve)));

      const { rerender } = renderProvider();
      await waitFor(() => expect(screen.getByTestId('message').textContent).not.toBe('none'));

      fireEvent.click(screen.getByTestId('sign'));

      mocks.address = ADDRESS_B;
      rerender(
        <ConnectedProvider>
          <Consumer />
        </ConnectedProvider>
      );

      resolveSign('0xsignature');
      await act(() => new Promise(resolve => setTimeout(resolve, 0)));

      expect(signed()).toBe('false');
    });

    it('a failed POST leaves the flag down and reports', async () => {
      mocks.signTermsAcceptance.mockResolvedValue({ ok: false, status: 500 });
      renderProvider();
      await waitFor(() => expect(screen.getByTestId('message').textContent).not.toBe('none'));

      fireEvent.click(screen.getByTestId('sign'));
      await act(() => new Promise(resolve => setTimeout(resolve, 0)));

      expect(signed()).toBe('false');
      expect(mocks.reportError).toHaveBeenCalled();
    });

    it('refuses to sign when /check carried no message', async () => {
      mocks.checkTermsWithRetry.mockResolvedValue(checkResult({ messageToSign: undefined }));
      renderProvider();
      await waitFor(() => expect(screen.getByTestId('version').textContent).toBe(VERSION));

      fireEvent.click(screen.getByTestId('sign'));
      await act(() => new Promise(resolve => setTimeout(resolve, 0)));

      expect(mocks.signMessageAsync).not.toHaveBeenCalled();
      expect(mocks.signTermsAcceptance).not.toHaveBeenCalled();
    });

    it('under the mock wallet: signs but skips the POST, and flips the flag', async () => {
      vi.stubEnv('VITE_USE_MOCK_WALLET', 'true');
      renderProvider();
      await waitFor(() => expect(screen.getByTestId('message').textContent).not.toBe('none'));

      fireEvent.click(screen.getByTestId('sign'));

      await waitFor(() => expect(signed()).toBe('true'));
      expect(mocks.signMessageAsync).toHaveBeenCalled();
      expect(mocks.signTermsAcceptance).not.toHaveBeenCalled();
    });

    it('discards a signature whose POST lands after an address switch', async () => {
      let resolveSign: (value: { ok: boolean }) => void = () => {};
      mocks.signTermsAcceptance.mockReturnValue(new Promise(resolve => (resolveSign = resolve)));

      const { rerender } = renderProvider();
      await waitFor(() => expect(screen.getByTestId('message').textContent).not.toBe('none'));

      fireEvent.click(screen.getByTestId('sign'));
      await act(() => new Promise(resolve => setTimeout(resolve, 0)));

      mocks.address = ADDRESS_B;
      rerender(
        <ConnectedProvider>
          <Consumer />
        </ConnectedProvider>
      );

      resolveSign({ ok: true });
      await act(() => new Promise(resolve => setTimeout(resolve, 0)));

      // Address B's own check is in flight/fresh — A's signature must not
      // have stamped `signedForCurrentVersion` onto B's state.
      expect(signed()).toBe('false');
    });
  });
});
