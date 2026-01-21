import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { useConnection } from 'wagmi';
import { useRestrictedAddressCheck, useVpnCheck } from '@jetstreamgg/sky-hooks';
import { sanitizeUrl } from '@/lib/utils';
import { IS_PRODUCTION_ENV } from '@/lib/constants';

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
    vpnIsLoading: boolean;
    vpnError?: Error;
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
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false);
  const [isCheckingTerms, setIsCheckingTerms] = useState(false);
  const [enabled, setEnabled] = useState(false);

  const skipAuthCheck = !IS_PRODUCTION_ENV && import.meta.env.VITE_SKIP_AUTH_CHECK === 'true';

  const authUrl = import.meta.env.VITE_AUTH_URL || 'https://staging-api.sky.money';
  const {
    data: authData,
    isLoading: authIsLoading,
    error: authError
  } = useRestrictedAddressCheck({ address, authUrl, enabled });

  const { data: vpnData, isLoading: vpnIsLoading, error: vpnError } = useVpnCheck({ authUrl });

  useEffect(() => {
    setEnabled(!!address);
  }, [address]);

  // Check whether the user is in a restricted region,
  // but only flag to reload if the current build is unrestricted
  const isRestrictedRegion = useMemo(
    () =>
      !vpnIsLoading &&
      (import.meta.env.VITE_RESTRICTED_BUILD !== 'true' || import.meta.env.VITE_RESTRICTED_MICA !== 'true') &&
      vpnData?.isRestrictedRegion,
    [vpnIsLoading, vpnData?.isRestrictedRegion]
  );

  // Reload page if build should be restricted, but isn't.
  // Since the user now appears to be in a restricted region, reloading
  // the page should serve them the correct build
  useEffect(() => {
    if (isRestrictedRegion) {
      // Add a slight delay to show message before reloading
      const timer = setTimeout(() => {
        window.location.reload();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isRestrictedRegion]);

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
          vpnIsLoading,
          vpnError
        }
      }}
    >
      {children}
    </ConnectedContext.Provider>
  );
};

export const useConnectedContext = () => useContext(ConnectedContext);
