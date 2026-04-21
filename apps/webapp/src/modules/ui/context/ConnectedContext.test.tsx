import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConnectedProvider, useConnectedContext } from './ConnectedContext';

const mockUseVpnCheck = vi.fn();
const mockCheckTermsWithRetry = vi.fn();
const mockTrackVpnCheckCompleted = vi.fn();

let mockPrivateDeployment = false;
let mockConnection = {
  isConnected: true,
  address: '0x1234567890123456789012345678901234567890'
};
let mockRestrictedAddressCheck = {
  data: { addressAllowed: true },
  isLoading: false,
  error: undefined
};
let mockVpnCheck = {
  data: { isConnectedToVpn: false, isRestrictedRegion: false, countryCode: 'SE' },
  isLoading: false,
  error: undefined
};

vi.mock('wagmi', () => ({
  useChainId: () => 1,
  useConnection: () => mockConnection
}));

vi.mock('@/lib/constants', () => ({
  IS_PRODUCTION_ENV: false
}));

vi.mock('@jetstreamgg/sky-hooks', () => ({
  useRestrictedAddressCheck: () => mockRestrictedAddressCheck,
  useVpnCheck: (args: unknown) => {
    mockUseVpnCheck(args);
    return mockVpnCheck;
  }
}));

vi.mock('@/lib/isPrivateDeployment', () => ({
  isPrivateDeployment: () => mockPrivateDeployment
}));

vi.mock('@/modules/analytics/hooks/useVpnAnalytics', () => ({
  useVpnAnalytics: () => ({
    trackVpnCheckCompleted: mockTrackVpnCheckCompleted
  })
}));

vi.mock('@/modules/ui/lib/checkTermsWithRetry', () => ({
  checkTermsWithRetry: (address: string) => mockCheckTermsWithRetry(address)
}));

function ContextSnapshot() {
  const { isAuthorized, isConnectedAndAcceptedTerms } = useConnectedContext();

  return (
    <>
      <div data-testid="authorized">{String(isAuthorized)}</div>
      <div data-testid="connected-accepted">{String(isConnectedAndAcceptedTerms)}</div>
    </>
  );
}

describe('ConnectedProvider private deployment handling', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_SKIP_AUTH_CHECK', 'false');
    mockPrivateDeployment = false;
    mockConnection = {
      isConnected: true,
      address: '0x1234567890123456789012345678901234567890'
    };
    mockRestrictedAddressCheck = {
      data: { addressAllowed: true },
      isLoading: false,
      error: undefined
    };
    mockVpnCheck = {
      data: { isConnectedToVpn: false, isRestrictedRegion: false, countryCode: 'SE' },
      isLoading: false,
      error: undefined
    };
    mockUseVpnCheck.mockClear();
    mockCheckTermsWithRetry.mockReset();
    mockTrackVpnCheckCompleted.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('keeps restricted-address enforcement enabled on private deployments', async () => {
    mockPrivateDeployment = true;
    mockRestrictedAddressCheck = {
      data: { addressAllowed: false },
      isLoading: false,
      error: undefined
    };
    mockCheckTermsWithRetry.mockResolvedValue({ termsAccepted: true, error: false });

    render(
      <ConnectedProvider>
        <ContextSnapshot />
      </ConnectedProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('authorized').textContent).toBe('false');
    });

    expect(mockUseVpnCheck).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: true
      })
    );
    expect(mockCheckTermsWithRetry).toHaveBeenCalledWith(mockConnection.address);
  });

  it('still requires terms acceptance on private deployments', async () => {
    mockPrivateDeployment = true;
    mockCheckTermsWithRetry.mockResolvedValue({ termsAccepted: false, error: false });

    render(
      <ConnectedProvider>
        <ContextSnapshot />
      </ConnectedProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('connected-accepted').textContent).toBe('false');
    });

    expect(screen.getByTestId('authorized').textContent).toBe('true');
    expect(mockCheckTermsWithRetry).toHaveBeenCalledWith(mockConnection.address);
  });
});
