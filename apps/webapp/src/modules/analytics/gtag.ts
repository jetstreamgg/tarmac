import { getStoredConsent, saveConsent } from './consentStorage';

const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID;

const gtag = function () {
  window.dataLayer = window.dataLayer || [];
  // gtag.js requires the native Arguments object — pushing a true Array breaks its consent state machine.
  // eslint-disable-next-line prefer-rest-params
  window.dataLayer.push(arguments);
} as (...args: unknown[]) => void;

function initializeGtag() {
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
  gtag('config', GA_MEASUREMENT_ID, {
    cookie_domain: 'auto',
    linker: {
      // Cross-domain (_gl) link-decoration allowlist. gtag matches a destination if its
      // hostname equals or is a subdomain-suffix of an entry, so we list specific
      // subdomains rather than the bare `sky.money` root (which would match every
      // subdomain, including docs).
      //
      // docs.sky.money is deliberately OMITTED: it's hosted on GitBook, which ignores
      // the _gl param and mishandles it in its URL/anchor routing (e.g. the footer's
      // /legal-terms#privacy-policy link). *.sky.money subdomains already share the
      // `.sky.money` _ga cookie via cookie_domain:'auto', so they don't need _gl anyway.
      //
      // The authoritative fix is removing docs.sky.money from this GA4 property's
      // cross-domain "Configure your domains" list; this allowlist is the in-repo
      // backstop and may be merged with (not override) that admin config.
      domains: ['app.sky.money', 'vote.sky.money', 'upgrademkrtosky.skyeco.com'],
      // Accept the incoming _gl param on inbound links so a client ID minted on the
      // marketing site (sky.money) carries into the app, stitching the visit into one
      // GA4 session. This is the receiving half only; the sending site must decorate
      // its outbound links to app.sky.money for there to be a _gl to accept.
      accept_incoming: true
    }
  });
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
