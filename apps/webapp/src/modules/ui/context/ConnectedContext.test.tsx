import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Shared spies/state between the mocks and assertions.
const mocks = vi.hoisted(() => ({
  checkTermsWithRetry: vi.fn(),
  trackVpnCheckCompleted: vi.fn(),
  reportError: vi.fn(),
  isPrivateDeployment: vi.fn(() => false)
}));

vi.mock('wagmi', async importOriginal => {
  const actual = await importOriginal<typeof import('wagmi')>();
  return {
    ...actual,
    useChainId: () => 1,
    useConnection: () => ({ isConnected: true, address: '0x1234567890123456789012345678901234567890' })
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

import { ConnectedProvider, useConnectedContext } from './ConnectedContext';

function Consumer() {
  const { isConnectedAndAcceptedTerms, latestTermsVersion } = useConnectedContext();
  return (
    <div>
      <span data-testid="accepted">{String(isConnectedAndAcceptedTerms)}</span>
      <span data-testid="version">{latestTermsVersion ?? 'none'}</span>
    </div>
  );
}

describe('ConnectedContext — version-aware terms gating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isPrivateDeployment.mockReturnValue(false);
    vi.stubEnv('VITE_SKIP_AUTH_CHECK', 'false');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('stays gated (re-prompts) when the wallet has not accepted the current terms version', async () => {
    mocks.checkTermsWithRetry.mockResolvedValue({
      termsAccepted: false,
      error: false,
      latestVersion: '2026-02-01'
    });

    render(
      <ConnectedProvider>
        <Consumer />
      </ConnectedProvider>
    );

    // Once the version-aware check resolves, the current version is surfaced (for the modal)...
    await waitFor(() => expect(screen.getByTestId('version').textContent).toBe('2026-02-01'));
    // ...and the wallet remains gated, so the terms modal stays up for re-signing.
    expect(screen.getByTestId('accepted').textContent).toBe('false');
  });

  it('opens the gate (no re-prompt) when the wallet has accepted the current terms version', async () => {
    mocks.checkTermsWithRetry.mockResolvedValue({
      termsAccepted: true,
      error: false,
      latestVersion: '2026-02-01'
    });

    render(
      <ConnectedProvider>
        <Consumer />
      </ConnectedProvider>
    );

    await waitFor(() => expect(screen.getByTestId('accepted').textContent).toBe('true'));
    expect(screen.getByTestId('version').textContent).toBe('2026-02-01');
  });
});
