import React, { createContext, useContext, useEffect, useRef, useState, useMemo } from 'react';
import { useChainId, useConnection } from 'wagmi';
import { useRestrictedAddressCheck, useVpnCheck } from '@jetstreamgg/sky-hooks';
import { sanitizeUrl } from '@/lib/utils';
import { IS_PRODUCTION_ENV } from '@/lib/constants';
import { useVpnAnalytics } from '@/modules/analytics/hooks/useVpnAnalytics';

interface ConnectedContextType {
  isConnectedAndAcceptedTerms: boolean;
  isAuthorized: boolean;
  setHasAcceptedTerms: (value: boolean) => void;
  isCheckingTerms: boolean;
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
  const [enabled, setEnabled] = useState(false);

  const skipAuthCheck = !IS_PRODUCTION_ENV && import.meta.env.VITE_SKIP_AUTH_CHECK === 'true';

  const authUrl = import.meta.env.VITE_AUTH_URL || 'https://staging-api.jetstream.gg';
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
    setEnabled(!!address);
  }, [address]);

  // Terms acceptance check
  const checkTermsAcceptance = async (address: string) => {
    setIsCheckingTerms(true);
    try {
      const response = await fetch(sanitizeUrl(`${import.meta.env.VITE_TERMS_ENDPOINT}/check`) || '', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ address })
      });

      if (response.ok) {
        const res = await response.json();
        setIsCheckingTerms(false);
        return res;
      } else {
        console.error('Failed to send signature');
        setIsCheckingTerms(false);
        // Handle error (e.g., show error message to user)
      }
    } catch (error) {
      console.error('Error sending signature:', error);
      setIsCheckingTerms(false);
      // Handle error (e.g., show error message to user)
    }
  };

  useEffect(() => {
    if (skipAuthCheck) {
      setHasAcceptedTerms(true);
      return;
    }
    if (isConnected && address) {
      checkTermsAcceptance(address).then(({ termsAccepted }) => {
        setHasAcceptedTerms(termsAccepted);
      });
    } else {
      setHasAcceptedTerms(false);
    }
  }, [isConnected, address]);

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
