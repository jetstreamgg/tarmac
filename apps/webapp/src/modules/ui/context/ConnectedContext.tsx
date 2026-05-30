import React, { createContext, useCallback, useContext, useEffect, useRef, useState, useMemo } from 'react';
import { useChainId, useConnection } from 'wagmi';
import { useRestrictedAddressCheck, useVpnCheck } from '@/hooks';
import { IS_PRODUCTION_ENV } from '@/lib/constants';
import { isPrivateDeployment } from '@/lib/isPrivateDeployment';
import { useVpnAnalytics } from '@/modules/analytics/hooks/useVpnAnalytics';
import { reportError } from '@/modules/sentry/reportError';
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

export const ConnectedContext = createContext<ConnectedContextType>({
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
  // Derived from `address` — no state needed. The previous
  // useState + useEffect(setEnabled(!!address), [address]) introduced a
  // one-render delay between address changing and enabled flipping.
  // `useRestrictedAddressCheck` now sees the correct `enabled` value in
  // the same render that `address` arrives.

  const skipAuthCheck =
    (!IS_PRODUCTION_ENV && import.meta.env.VITE_SKIP_AUTH_CHECK === 'true') || isPrivateDeployment();

  const authUrl = import.meta.env.VITE_AUTH_URL || 'https://staging-api.sky.money';
  const {
    data: authData,
    isLoading: authIsLoading,
    error: authError
  } = useRestrictedAddressCheck({ address, authUrl, enabled: !!address, chainId });

  const {
    data: vpnData,
    isLoading: vpnIsLoading,
    error: vpnError
  } = useVpnCheck({ authUrl, skip: skipAuthCheck });

  // Track VPN check result once when data or error resolves
  const { trackVpnCheckCompleted } = useVpnAnalytics();
  const vpnTrackedRef = useRef(false);

  useEffect(() => {
    if (vpnError) {
      reportError(vpnError, {
        module: 'auth',
        flow: 'vpn-check',
        action: 'fetch',
        type: 'vpn_check_error'
      });
    }
  }, [vpnError]);

  useEffect(() => {
    if (authError) {
      reportError(authError, {
        module: 'auth',
        flow: 'address-check',
        action: 'fetch',
        type: 'address_check_error'
      });
    }
  }, [authError]);

  const enabled = !!address;

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
      reportError(result.lastError ?? new Error('Terms check failed after retries'), {
        module: 'auth',
        flow: 'terms-check',
        action: 'fetch',
        type: 'terms_check_error'
      });
      setTermsCheckError(true);
    } else if (result.accessDenied) {
      // 403 is an intentional access denial (VPN/region or sanctioned address).
      // The VPN/address hooks handle the blocked UI — just mark terms as not accepted.
      setHasAcceptedTerms(false);
    } else {
      setHasAcceptedTerms(result.termsAccepted);
    }
  }, []);

  const retryTermsCheck = useCallback(() => {
    if (isConnected && address) {
      checkTermsAcceptance(address);
    }
  }, [isConnected, address, checkTermsAcceptance]);

  // Split into render-time setStates + effect-only async call.
  // The sync setStates (skipAuthCheck, disconnect paths) move to render-time
  // with a [null] sentinel so mount-fire still flips hasAcceptedTerms=true
  // when skipAuthCheck is initially true. The async checkTermsAcceptance
  // call stays in a useEffect (can't fire async work from render).
  const [prevAuthDeps, setPrevAuthDeps] = useState<
    { isConnected: boolean; address: typeof address; skipAuthCheck: boolean } | null
  >(null);
  if (
    prevAuthDeps === null ||
    prevAuthDeps.isConnected !== isConnected ||
    prevAuthDeps.address !== address ||
    prevAuthDeps.skipAuthCheck !== skipAuthCheck
  ) {
    setPrevAuthDeps({ isConnected, address, skipAuthCheck });
    if (skipAuthCheck) {
      setHasAcceptedTerms(true);
    } else if (!isConnected || !address) {
      setHasAcceptedTerms(false);
      setTermsCheckError(false);
    }
    // Connected + !skipAuthCheck case → handled by the effect below
    // (checkTermsAcceptance is async and sets its own state internally).
  }

  useEffect(() => {
    if (!skipAuthCheck && isConnected && address) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- legitimate async kick-off: checkTermsAcceptance fires sync setStates at its top (setIsCheckingTerms(true), setTermsCheckError(false)) before its first await. activeAddressRef inside dedupes stale responses
      checkTermsAcceptance(address);
    }
  }, [isConnected, address, skipAuthCheck, checkTermsAcceptance]);

  const isAllowed = useMemo(
    () =>
      !vpnData?.isConnectedToVpn &&
      !vpnData?.isRestrictedRegion &&
      (!enabled || (enabled && authData?.addressAllowed)) &&
      !authError &&
      !vpnError,
    [
      vpnData?.isConnectedToVpn,
      vpnData?.isRestrictedRegion,
      enabled,
      authData?.addressAllowed,
      authError,
      vpnError
    ]
  );

  const isAuthorized = isAllowed || skipAuthCheck;
  const isConnectedAndAcceptedTerms = isConnected && hasAcceptedTerms;

  useEffect(() => {
    if (skipAuthCheck || vpnIsLoading || vpnTrackedRef.current) return;
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
  }, [skipAuthCheck, vpnIsLoading, vpnData, vpnError, isAllowed, trackVpnCheckCompleted]);

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
