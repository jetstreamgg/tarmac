import { getStoredConsent, saveConsent } from './consentStorage';

const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID;

function gtag(...args: unknown[]) {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(args);
}

export function initializeGtag() {
  if (typeof window === 'undefined' || !GA_MEASUREMENT_ID) {
    return;
  }

  const existing = document.querySelector(
    `script[src="https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}"]`
  );
  if (existing) {
    return;
  }

  const consent = getStoredConsent();
  const hasAccepted = consent?.google_analytics === true;

  // Set consent mode defaults before loading the script.
  // When denied, gtag sends cookieless pings only — no analytics cookies are set.
  gtag('consent', 'default', {
    analytics_storage: hasAccepted ? 'granted' : 'denied'
  });

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(script);

  gtag('js', new Date());
  gtag('config', GA_MEASUREMENT_ID, { cookie_domain: 'auto' });
}

/**
 * Apply a consent change at runtime.
 * Called from the cookie consent banner when the user accepts or rejects GA.
 */
export function applyGtagConsent(enabled: boolean) {
  saveConsent({ google_analytics: enabled });

  if (typeof window === 'undefined' || !GA_MEASUREMENT_ID) {
    return;
  }

  gtag('consent', 'update', {
    analytics_storage: enabled ? 'granted' : 'denied'
  });
}

declare global {
  interface Window {
    dataLayer: unknown[];
  }
}

initializeGtag();
