import React, { createContext, useCallback, useContext, useEffect, useRef, useState, useMemo } from 'react';
import * as Sentry from '@sentry/react';
import { useChainId, useConnection } from 'wagmi';
import { useRestrictedAddressCheck, useVpnCheck } from '@jetstreamgg/sky-hooks';
import { IS_PRODUCTION_ENV } from '@/lib/constants';
import { useVpnAnalytics } from '@/modules/analytics/hooks/useVpnAnalytics';
import { checkTermsWithRetry } from '@/modules/ui/lib/checkTermsWithRetry';

interface ConnectedContextType {
  isConnectedAndAcceptedTerms: boolean;
  isAuthorized: boolean;
  setHasAcceptedTerms: (value: boolean) => void;
  isCheckingTerms: boolean;
  termsCheckError: boolean;
  retryTermsCheck: () => void;
  authData: {
    addressAllowed?: boolean;
    authIsLoading: boolean;
    address?: string;
    authError?: Error;
  };
  vpnData: {
    isConnectedToVpn?: boolean;
    isRestrictedRegion?: boolean;
    vpnIsLoading: boolean;
    vpnError?: Error;
    countryCode?: string | null;
  };
}

const ConnectedContext = createContext<ConnectedContextType>({
  isConnectedAndAcceptedTerms: false,
  isAuthorized: false,
  setHasAcceptedTerms: () => {},
  isCheckingTerms: false,
  termsCheckError: false,
  retryTermsCheck: () => {},
  authData: {
    authIsLoading: false
  },
  vpnData: {
    vpnIsLoading: false
  }
});

export const ConnectedProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isConnected, address } = useConnection();
  const chainId = useChainId();
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false);
  const [isCheckingTerms, setIsCheckingTerms] = useState(false);
  const [termsCheckError, setTermsCheckError] = useState(false);
  const [enabled, setEnabled] = useState(false);

  const skipAuthCheck = !IS_PRODUCTION_ENV && import.meta.env.VITE_SKIP_AUTH_CHECK === 'true';

  const authUrl = import.meta.env.VITE_AUTH_URL || 'https://staging-api.sky.money';
  const {
    data: authData,
    isLoading: authIsLoading,
    error: authError
  } = useRestrictedAddressCheck({ address, authUrl, enabled, chainId });

  const { data: vpnData, isLoading: vpnIsLoading, error: vpnError } = useVpnCheck({ authUrl });

  // Track VPN check result once when data or error resolves
  const { trackVpnCheckCompleted } = useVpnAnalytics();
  const vpnTrackedRef = useRef(false);

  useEffect(() => {
    if (vpnError) {
      Sentry.captureException(vpnError, { tags: { endpoint: 'ip-status' } });
    }
  }, [vpnError]);

  useEffect(() => {
    if (authError) {
      Sentry.captureException(authError, { tags: { endpoint: 'address-status' } });
    }
  }, [authError]);

  useEffect(() => {
    setEnabled(!!address);
  }, [address]);

  // Guard against stale responses when the address changes mid-flight
  const activeAddressRef = useRef<string | null>(null);

  // Terms acceptance check with retry
  const checkTermsAcceptance = useCallback(async (addr: string) => {
    activeAddressRef.current = addr;
    setIsCheckingTerms(true);
    setTermsCheckError(false);

    const result = await checkTermsWithRetry(addr);

    // Discard result if the address changed while the check was in flight
    if (activeAddressRef.current !== addr) return;

    setIsCheckingTerms(false);

    if (result.error) {
      Sentry.captureException(result.lastError ?? new Error('Terms check failed after retries'), {
        tags: { endpoint: 'terms-check' }
      });
      setTermsCheckError(true);
    } else {
      setHasAcceptedTerms(result.termsAccepted);
    }
  }, []);

  const retryTermsCheck = useCallback(() => {
    if (isConnected && address) {
      checkTermsAcceptance(address);
    }
  }, [isConnected, address, checkTermsAcceptance]);

  useEffect(() => {
    if (skipAuthCheck) {
      setHasAcceptedTerms(true);
      return;
    }
    if (isConnected && address) {
      checkTermsAcceptance(address);
    } else {
      setHasAcceptedTerms(false);
      setTermsCheckError(false);
    }
  }, [isConnected, address, skipAuthCheck, checkTermsAcceptance]);

  const isAllowed = useMemo(
    () =>
      !vpnData?.isConnectedToVpn &&
      (!enabled || (enabled && authData?.addressAllowed)) &&
      !authError &&
      !vpnError,
    [vpnData?.isConnectedToVpn, enabled, authData?.addressAllowed, authError, vpnError]
  );

  const isAuthorized = isAllowed || skipAuthCheck;
  const isConnectedAndAcceptedTerms = isConnected && hasAcceptedTerms;

  useEffect(() => {
    if (vpnIsLoading || vpnTrackedRef.current) return;
    if (!vpnData && !vpnError) return;
    vpnTrackedRef.current = true;
    const result = vpnError
      ? 'error'
      : vpnData?.isConnectedToVpn
        ? 'vpn_blocked'
        : vpnData?.isRestrictedRegion
          ? 'region_blocked'
          : isAllowed
            ? 'allowed'
            : 'unknown';
    trackVpnCheckCompleted({
      isVpn: vpnData?.isConnectedToVpn ?? null,
      isRestrictedRegion: vpnData?.isRestrictedRegion ?? null,
      countryCode: vpnData?.countryCode ?? null,
      result
    });
  }, [vpnIsLoading, vpnData, vpnError, isAllowed, trackVpnCheckCompleted]);

  return (
    <ConnectedContext.Provider
      value={{
        isConnectedAndAcceptedTerms,
        isAuthorized,
        setHasAcceptedTerms,
        isCheckingTerms,
        termsCheckError,
        retryTermsCheck,
        authData: {
          addressAllowed: authData?.addressAllowed,
          authIsLoading,
          address,
          authError
        },
        vpnData: {
          isConnectedToVpn: vpnData?.isConnectedToVpn,
          isRestrictedRegion: vpnData?.isRestrictedRegion,
          vpnIsLoading,
          vpnError,
          countryCode: vpnData?.countryCode ?? null
        }
      }}
    >
      {children}
    </ConnectedContext.Provider>
  );
};

export const useConnectedContext = () => useContext(ConnectedContext);
