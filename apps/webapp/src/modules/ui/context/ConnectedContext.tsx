import React, { createContext, useCallback, useContext, useEffect, useRef, useState, useMemo } from 'react';
import { useConnection } from 'wagmi';
import { useRestrictedAddressCheck, useVpnCheck } from '@/hooks';
import { IS_PRODUCTION_ENV } from '@/lib/constants';
import { isPrivateDeployment } from '@/lib/isPrivateDeployment';
import { useVpnAnalytics } from '@/modules/analytics/hooks/useVpnAnalytics';
import { reportError } from '@/modules/sentry/reportError';
import { addTermsAcceptance } from '@/modules/ui/lib/addTermsAcceptance';
import { checkTermsWithRetry, type TermsCheckData } from '@/modules/ui/lib/checkTermsWithRetry';
import { useTermsAcceptance } from '@/modules/ui/hooks/useTermsAcceptance';

interface ConnectedContextType {
  isConnectedAndAcceptedTerms: boolean;
  isAuthorized: boolean;
  isCheckingTerms: boolean;
  termsCheckError: boolean;
  retryTermsCheck: () => void;
  /**
   * The localStorage flag AND the DB's `accepted` — either half missing
   * re-prompts. Gates browsing (APP-499).
   */
  hasAcceptedTerms: boolean;
  /**
   * `signedForCurrentVersion` from `/check`. Gates the per-transaction
   * signature step (C6) and nothing else — a user with no signature browses
   * normally, which is the whole point of the two-phase split.
   */
  hasSignedCurrentTerms: boolean;
  /** Current terms version: keys the local flag, and renders in the modal footer (C4). */
  latestTermsVersion?: string;
  /**
   * The exact text C6 passes to `signMessage`. Served by the worker on
   * `/check` (APP-508) — the webapp holds no copy of it, so the string the
   * user signs is the one the worker verifies.
   */
  termsMessageToSign?: string;
  /**
   * Phase A acceptance: posts to `/terms-acceptance/add`, then writes the
   * local flag — in that order. Resolves false if the write failed, leaving
   * the user re-prompted rather than browsing unrecorded.
   */
  acceptTerms: () => Promise<boolean>;
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
  isCheckingTerms: false,
  termsCheckError: false,
  retryTermsCheck: () => {},
  hasAcceptedTerms: false,
  hasSignedCurrentTerms: false,
  acceptTerms: async () => false,
  authData: {
    authIsLoading: false
  },
  vpnData: {
    vpnIsLoading: false
  }
});

export const ConnectedProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isConnected, address, chainId, connector } = useConnection();
  const [termsCheck, setTermsCheck] = useState<TermsCheckData | undefined>(undefined);
  const [isCheckingTerms, setIsCheckingTerms] = useState(false);
  const [termsCheckError, setTermsCheckError] = useState(false);
  const [enabled, setEnabled] = useState(false);

  const skipAuthCheck =
    (!IS_PRODUCTION_ENV && import.meta.env.VITE_SKIP_AUTH_CHECK === 'true') || isPrivateDeployment();

  const authUrl = import.meta.env.VITE_AUTH_URL || 'https://staging-api.sky.money';
  const {
    data: authData,
    isLoading: authIsLoading,
    error: authError
  } = useRestrictedAddressCheck({ address, authUrl, enabled });

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

    if (result.status === 'error') {
      reportError(result.lastError ?? new Error('Terms check failed after retries'), {
        module: 'auth',
        flow: 'terms-check',
        action: 'fetch',
        type: 'terms_check_error'
      });
      setTermsCheck(undefined);
      setTermsCheckError(true);
    } else if (result.status === 'access-denied') {
      // 403 is an intentional access denial (VPN/region or sanctioned address).
      // The VPN/address hooks handle the blocked UI — just hold no terms state.
      setTermsCheck(undefined);
    } else {
      setTermsCheck(result);
    }
  }, []);

  const retryTermsCheck = useCallback(() => {
    if (isConnected && address) {
      checkTermsAcceptance(address);
    }
  }, [isConnected, address, checkTermsAcceptance]);

  useEffect(() => {
    if (skipAuthCheck) return;
    if (isConnected && address) {
      checkTermsAcceptance(address);
    } else {
      setTermsCheck(undefined);
      setTermsCheckError(false);
    }
  }, [isConnected, address, skipAuthCheck, checkTermsAcceptance]);

  const { hasLocalAcceptance, recordLocalAcceptance } = useTermsAcceptance({
    address,
    version: termsCheck?.latestVersion
  });

  // The AND gate (APP-499). A DB row alone doesn't prove this browser was ever
  // shown the terms for this address, and a local flag alone doesn't prove
  // anything was recorded — so either half missing re-prompts.
  const hasAcceptedTerms = skipAuthCheck || (!!termsCheck?.accepted && hasLocalAcceptance);

  // `skipAuthCheck` is the dev/e2e bypass. It opens both halves so no
  // environment that skips the gate ends up demanding a signature at Confirm
  // instead; C7 aligns the bypasses with the two-phase model.
  const hasSignedCurrentTerms = skipAuthCheck || !!termsCheck?.signedForCurrentVersion;

  const acceptTerms = useCallback(async (): Promise<boolean> => {
    if (!address) return false;

    // The mock wallet can't produce a real acceptance record, and local dev
    // points at the shared staging endpoint — so bypass the write, as the old
    // signature path did.
    if (import.meta.env.VITE_USE_MOCK_WALLET === 'true') {
      recordLocalAcceptance();
      setTermsCheck(prev => (prev ? { ...prev, accepted: true } : prev));
      return true;
    }

    const result = await addTermsAcceptance(address);

    if (!result.ok) {
      reportError(result.lastError ?? new Error('Terms acceptance failed'), {
        module: 'auth',
        flow: 'terms-acceptance',
        action: 'submit',
        type: 'terms_acceptance_error',
        statusCode: result.status,
        extra: { chainId, connector: connector?.name }
      });
      return false;
    }

    // Order matters: the local flag goes on only after the DB write succeeded.
    // The reverse leaves a user browsing with no record anywhere — the exact
    // hole this gate exists to close.
    recordLocalAcceptance();
    setTermsCheck(prev => (prev ? { ...prev, accepted: true } : prev));
    return true;
  }, [address, chainId, connector?.name, recordLocalAcceptance]);

  const isAllowed = useMemo(
    () =>
      !vpnData?.isConnectedToVpn &&
      !vpnData?.isRestrictedRegion &&
      (!enabled || (enabled && authData?.addressAllowed)) &&
      // Fail closed only when there is no verdict at all. A failed background
      // refetch keeps the cached data and sets `error`, so gating on `authError`
      // alone would discard an approval we already hold.
      !(authError && !authData) &&
      !vpnError,
    [vpnData?.isConnectedToVpn, vpnData?.isRestrictedRegion, enabled, authData, authError, vpnError]
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
        isCheckingTerms,
        termsCheckError,
        retryTermsCheck,
        hasAcceptedTerms,
        hasSignedCurrentTerms,
        latestTermsVersion: termsCheck?.latestVersion,
        termsMessageToSign: termsCheck?.messageToSign,
        acceptTerms,
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
