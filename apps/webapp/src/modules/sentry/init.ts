import * as Sentry from '@sentry/react';
import { useEffect } from 'react';
import {
  createRoutesFromChildren,
  matchRoutes,
  useLocation,
  useNavigationType
} from 'react-router-dom';

// Fall back to the app-wide env name so Sentry still gets a meaningful environment
// even before dedicated VITE_SENTRY_* values are populated everywhere.
const environment = import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.VITE_ENV_NAME || 'development';
const release =
  import.meta.env.VITE_SENTRY_RELEASE ||
  import.meta.env.VITE_CF_PAGES_COMMIT_SHA ||
  `${__APP_VERSION__}-${environment}`;
const isProd = environment === 'production';
const isDebug = import.meta.env.VITE_SENTRY_DEBUG === 'true';
const shouldSendDevEvents = isProd || isDebug;

let hasInitializedSentry = false;

export function initSentry(): void {
  if (typeof window === 'undefined' || hasInitializedSentry) {
    return;
  }

  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) {
    return;
  }

  Sentry.init({
    dsn,
    environment,
    release,
    debug: !isProd && isDebug,
    // Local/dev stays fully off unless debug is explicitly enabled. When debug is on,
    // use 100% sampling so instrumentation can be verified end-to-end.
    tracesSampleRate: !shouldSendDevEvents ? 0 : isProd ? 0.1 : 1.0,
    ignoreErrors: [
      // DOM mutation errors caused by browser extensions modifying nodes outside
      // React's control. These surface as React reconciliation failures and are
      // not actionable.
      /Failed to execute 'removeChild' on 'Node'/,
      /Failed to execute 'insertBefore' on 'Node'/,
      /The object can not be found here/
    ],
    integrations: [
      Sentry.thirdPartyErrorFilterIntegration({
        filterKeys: ['sky-webapp'],
        behaviour: 'drop-error-if-exclusively-contains-third-party-frames'
      }),
      Sentry.browserTracingIntegration(),
      Sentry.reactRouterV6BrowserTracingIntegration({
        useEffect,
        useLocation,
        useNavigationType,
        createRoutesFromChildren,
        matchRoutes
      })
    ],
    beforeSend(event) {
      if (!shouldSendDevEvents) {
        return null;
      }

      return event;
    }
  });
  hasInitializedSentry = true;
}
