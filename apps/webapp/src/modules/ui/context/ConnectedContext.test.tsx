import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
const VERSION = '2026-01-15';

// Shared spies/state between the mocks and assertions.
const mocks = vi.hoisted(() => ({
  checkTermsWithRetry: vi.fn(),
  addTermsAcceptance: vi.fn(),
  trackVpnCheckCompleted: vi.fn(),
  reportError: vi.fn(),
  isPrivateDeployment: vi.fn(() => false),
  address: '0x1234567890123456789012345678901234567890' as string | undefined
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
    })
  };
});

vi.mock('@/hooks', () => ({
  useRestrictedAddressCheck: () => ({ data: { addressAllowed: true }, isLoading: false, error: undefined }),
  useVpnCheck: () => ({
    data: { isConnectedToVpn: false, isRestrictedRegion: false, countryCode: 'US' },
    isLoading: false,
    error: undefined
  })
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

import { ConnectedProvider, useConnectedContext } from './ConnectedContext';

function Consumer() {
  const {
    hasAcceptedTerms,
    hasSignedCurrentTerms,
    isConnectedAndAcceptedTerms,
    latestTermsVersion,
    termsMessageToSign,
    acceptTerms
  } = useConnectedContext();
  return (
    <div>
      <span data-testid="accepted">{String(hasAcceptedTerms)}</span>
      <span data-testid="browsing">{String(isConnectedAndAcceptedTerms)}</span>
      <span data-testid="signed">{String(hasSignedCurrentTerms)}</span>
      <span data-testid="version">{latestTermsVersion ?? 'none'}</span>
      <span data-testid="message">{termsMessageToSign ?? 'none'}</span>
      <button data-testid="accept" onClick={() => void acceptTerms()}>
        accept
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
    mocks.checkTermsWithRetry.mockResolvedValue(checkResult({ latestVersion: '2026-06-01' }));

    renderProvider();

    await waitFor(() => expect(screen.getByTestId('version').textContent).toBe('2026-06-01'));
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

      await waitFor(() => expect(mocks.checkTermsWithRetry).toHaveBeenCalled());
      expect(accepted()).toBe('false');
      expect(mocks.reportError).not.toHaveBeenCalled();
    });
  });
});
