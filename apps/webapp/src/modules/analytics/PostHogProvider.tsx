import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';
import { type ReactNode } from 'react';
import { getStoredConsent, saveConsent } from './consentStorage';

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY;
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST;
const POSTHOG_ENABLED = import.meta.env.VITE_POSTHOG_ENABLED === 'true';

let hasInitializedPostHog = false;

/**
 * Initialize PostHog with consent-based configuration.
 *
 * Consent is stored in the cross-subdomain sky_consent cookie (shared across *.sky.money).
 *
 * - Rejected users: PostHog is NOT initialized (zero events).
 * - Pending users: Cookieless anonymous tracking (cookieless_mode: 'always').
 * - Accepted users: Full persistent tracking.
 *
 * Requires "Cookieless server hash mode" enabled in PostHog project settings.
 */
export function initializePostHogIfNeeded(forceAccepted = false) {
  if (typeof window === 'undefined' || !POSTHOG_ENABLED || !POSTHOG_KEY || hasInitializedPostHog) {
    return;
  }

  const consent = getStoredConsent();
  const hasAccepted = forceAccepted || consent?.posthog === true;
  const hasRejected = consent?.posthog === false;

  if (hasRejected && !forceAccepted) {
    return;
  }

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    capture_pageview: 'history_change',
    capture_pageleave: true,
    persistence: 'localStorage+cookie',
    cookieless_mode: hasAccepted ? undefined : 'always',
    autocapture: false,
    disable_session_recording: true,
    disable_surveys: true,
    disable_web_experiments: true,
    respect_dnt: true,
    ip: false,
    property_denylist: ['$ip'],
    cross_subdomain_cookie: true,

    loaded: posthogClient => {
      posthogClient.register({ app_name: 'app' });

      if (hasAccepted) {
        posthogClient.opt_in_capturing();
      }

      if (import.meta.env.DEV) {
        posthogClient.debug();
      }
    }
  });

  hasInitializedPostHog = true;
}

// Initialize immediately unless rejected.
initializePostHogIfNeeded();

/**
 * Apply a consent change at runtime.
 * Handles cookieless → full tracking transitions (and vice versa).
 * Writes directly to the cross-subdomain sky_consent cookie.
 */
export function applyPostHogConsent(enabled: boolean) {
  if (enabled) {
    initializePostHogIfNeeded(true);
    posthog.set_config({ cookieless_mode: undefined });
    posthog.reset();
    posthog.opt_in_capturing();
    posthog.register({ app_name: 'app' });
  } else {
    if (!hasInitializedPostHog) return;
    posthog.set_config({ cookieless_mode: undefined });
    posthog.reset();
    posthog.opt_out_capturing();
  }

  // saveConsent writes to the cookie immediately — no timing issues.
  saveConsent({ posthog: enabled });
}

/**
 * PostHog React provider. Kill switch: renders children without PostHog when disabled.
 */
export function PostHogProvider({ children }: { children: ReactNode }) {
  if (!POSTHOG_ENABLED || !POSTHOG_KEY) {
    return <>{children}</>;
  }

  return <PHProvider client={posthog}>{children}</PHProvider>;
}
