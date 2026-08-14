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

/**
 * Why the access gate is closed. `undefined` while allowed or still resolving
 * (the loading state is carried by `authData`/`vpnData`). Every reason is
 * fail-closed: an unavailable check never opens the gate, it gets its own
 * distinct state instead so users can tell "blocked" from "try again later".
 */
export type AccessBlockReason =
  'region-restricted' | 'ip-check-unavailable' | 'wallet-blocked' | 'screening-unavailable';

interface ConnectedContextType {
  isConnectedAndAcceptedTerms: boolean;
  isAuthorized: boolean;
  accessBlockReason?: AccessBlockReason;
  /**
   * The user is browsing from the US, per `/ip/status`'s country code. Gates
   * the per-transaction signature step (C6) together with
   * `vpnData.isConnectedToVpn`. Undefined until the check resolves — the
   * consumer decides how to treat an unknown location.
   */
  isUsUser?: boolean;
  /** Re-runs the /ip/status and address-screening checks (the "check again" path). */
  retryAccessChecks: () => void;
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
  retryAccessChecks: () => {},
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
    error: authError,
    refetch: refetchAddressCheck
  } = useRestrictedAddressCheck({ address, authUrl, enabled });

  const {
    data: vpnData,
    isLoading: vpnIsLoading,
    error: vpnError,
    refetch: refetchVpnCheck
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

  // The address changing (including to undefined on disconnect) invalidates
  // any terms verdict already held — it belongs to the previous address.
  useEffect(() => {
    setTermsCheck(undefined);
    setTermsCheckError(false);
  }, [address]);

  // The flow puts address screening between wallet selection and the T&C gate
  // (APP-497): the terms check fires only once screening has cleared the
  // address, so a blocked wallet sees the blocked screen, never the terms
  // modal — and the ordering is guaranteed rather than incidental.
  const addressScreeningPassed = authData?.addressAllowed === true;

  useEffect(() => {
    if (skipAuthCheck) return;
    if (isConnected && address && addressScreeningPassed) {
      checkTermsAcceptance(address);
    }
  }, [isConnected, address, addressScreeningPassed, skipAuthCheck, checkTermsAcceptance]);

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

  /**
   * Writes the local flag and reports if it could not be written. Returning
   * true regardless is what would strand a user: the DB row exists, the AND
   * gate's local half does not, so the modal reopens and every retry appends
   * another acceptance event. Surfacing false keeps the modal open with its
   * error instead of looping silently.
   */
  const reportUnlessRecorded = useCallback(() => {
    if (recordLocalAcceptance()) return true;

    reportError(new Error('Terms accepted but the local flag could not be recorded'), {
      module: 'auth',
      flow: 'terms-acceptance',
      action: 'submit',
      type: 'terms_local_flag_error'
    });
    return false;
  }, [recordLocalAcceptance]);

  const acceptTerms = useCallback(async (): Promise<boolean> => {
    // Without an address, or before the check has reported a version, there is
    // no key for the local flag — so the gate could never open, and posting
    // anyway would leave an acceptance event that nothing can ever satisfy.
    // Refuse before writing. The modal holds its loading state until the check
    // resolves, so this is a guard rather than a path users take.
    if (!address || !termsCheck?.latestVersion) return false;

    // The mock wallet can't produce a real acceptance record, and local dev
    // points at the shared staging endpoint — so bypass the write, as the old
    // signature path did.
    if (import.meta.env.VITE_USE_MOCK_WALLET === 'true') {
      setTermsCheck(prev => (prev ? { ...prev, accepted: true } : prev));
      return reportUnlessRecorded();
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
    setTermsCheck(prev => (prev ? { ...prev, accepted: true } : prev));
    return reportUnlessRecorded();
  }, [address, chainId, connector?.name, reportUnlessRecorded, termsCheck?.latestVersion]);

  // A VPN is deliberately absent here (APP-497): VPN users browse and transact
  // normally, and the safeguard is the per-transaction terms signature (C6),
  // not a wall. Genuinely restricted jurisdictions still block.
  const accessBlockReason = useMemo<AccessBlockReason | undefined>(() => {
    if (vpnData?.isRestrictedRegion) return 'region-restricted';
    // Fail closed only when there is no verdict at all. A failed background
    // refetch keeps the cached data and sets `error`, so gating on the error
    // alone would discard a verdict we already hold.
    if (vpnError && !vpnData) return 'ip-check-unavailable';
    if (enabled) {
      if (authData?.addressAllowed === false) return 'wallet-blocked';
      if (authError && !authData) return 'screening-unavailable';
    }
    return undefined;
  }, [vpnData, vpnError, enabled, authData, authError]);

  // `undefined !== true` while screening is in flight, so a connected address
  // stays gated (behind the loading dialog) until a verdict lands.
  const isAllowed = !accessBlockReason && (!enabled || authData?.addressAllowed === true);

  const isAuthorized = isAllowed || skipAuthCheck;
  const isConnectedAndAcceptedTerms = isConnected && hasAcceptedTerms;

  // "Is US" for the pre-transaction signature gate (C6): US or VPN users sign
  // the current terms at Confirm. Derived from the same `/ip/status` payload
  // as `isConnectedToVpn`, so the pair shares one loading state and verdict.
  const isUsUser = vpnData ? vpnData.countryCode === 'US' : undefined;

  const retryAccessChecks = useCallback(() => {
    refetchVpnCheck();
    if (enabled) refetchAddressCheck();
  }, [refetchVpnCheck, refetchAddressCheck, enabled]);

  useEffect(() => {
    if (skipAuthCheck || vpnIsLoading || vpnTrackedRef.current) return;
    if (!vpnData && !vpnError) return;
    vpnTrackedRef.current = true;
    // A VPN no longer blocks (APP-497), so it is not an outcome here — the
    // captured `is_vpn` property carries that fact instead.
    const result = vpnError
      ? 'error'
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
        accessBlockReason,
        isUsUser,
        retryAccessChecks,
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
