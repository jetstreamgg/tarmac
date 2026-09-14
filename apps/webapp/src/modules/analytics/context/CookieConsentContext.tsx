import React, { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { type ServiceConsent, getStoredConsent, saveConsent } from '../consentStorage';

export type BannerView = 'default' | 'manage';

interface CookieConsentContextProps {
  readonly consent: ServiceConsent | null;
  readonly bannerVisible: boolean;
  readonly bannerView: BannerView;
  readonly bannerHeight: number;
  readonly setBannerView: (view: BannerView) => void;
  readonly setBannerHeight: (height: number) => void;
  readonly setConsent: (consent: ServiceConsent) => void;
  readonly showBanner: () => void;
  readonly hideBanner: () => void;
}

const CookieConsentContext = createContext<CookieConsentContextProps | undefined>(undefined);

export function CookieConsentProvider({ children }: { children: ReactNode }) {
  const [consent, setConsentState] = useState<ServiceConsent | null>(getStoredConsent);
  const [bannerVisible, setBannerVisible] = useState(() => getStoredConsent() === null);
  const [bannerView, setBannerView] = useState<BannerView>('default');
  const [bannerHeight, setBannerHeight] = useState(0);

  // Re-read cookie when tab becomes visible (cross-subdomain sync).
  // Handles: user changes consent on sky.money, switches back to this tab.
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      const freshConsent = getStoredConsent();
      setConsentState(prev => {
        if (JSON.stringify(prev) === JSON.stringify(freshConsent)) return prev;
        return freshConsent;
      });
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const setConsent = useCallback((newConsent: ServiceConsent) => {
    setConsentState(newConsent);
    saveConsent(newConsent);
    setBannerVisible(false);
  }, []);

  const showBanner = useCallback(() => {
    // Re-read the cookie to pick up cross-subdomain changes
    // (e.g. user changed consent on sky.money, then opens Cookie Settings here)
    const freshConsent = getStoredConsent();
    setConsentState(freshConsent);
    setBannerView('default');
    setBannerVisible(true);
  }, []);

  const hideBanner = useCallback(() => setBannerVisible(false), []);

  return (
    <CookieConsentContext.Provider
      value={{
        consent,
        bannerVisible,
        bannerView,
        bannerHeight,
        setBannerView,
        setBannerHeight,
        setConsent,
        showBanner,
        hideBanner
      }}
    >
      {children}
    </CookieConsentContext.Provider>
  );
}

export function useCookieConsent() {
  const context = useContext(CookieConsentContext);
  if (!context) {
    throw new Error('useCookieConsent must be used within a CookieConsentProvider');
  }
  return context;
}
