import * as Sentry from '@sentry/react';
import { useEffect } from 'react';
import { createRoutesFromChildren, matchRoutes, useLocation, useNavigationType } from 'react-router-dom';

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
      // Errors thrown by wallet browser extensions / in-app browsers, not by our code.
      /not found rainbowkit/i,
      // WebSocket race condition in MetaMask mobile wallet SDK (centrifuge lib).
      // Not actionable on our side (WEBAPP-2F).
      /null is not an object \(evaluating 'this\._transport\.close'\)/,
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

      // Drop WalletConnect relay WebSocket errors caused by client clock skew.
      // These are unactionable — the relay server rejects JWTs when the user's
      // system clock drifts beyond the leeway, triggering a reconnect storm.
      // We scope the filter to WalletConnect frames + "not yet valid" to avoid
      // masking genuine JWT issues from other parts of the stack.
      const firstException = event.exception?.values?.[0];
      const message = firstException?.value ?? '';
      const frames = firstException?.stacktrace?.frames ?? [];
      const isWalletConnectOrigin = frames.some(f => f.filename?.includes('@walletconnect/'));
      if (
        isWalletConnectOrigin &&
        message.includes('WebSocket connection closed abnormally') &&
        message.includes('JWT Token is not yet valid')
      ) {
        return null;
      }

      // Drop network-layer fetch errors from api.sky.money poll endpoints.
      // These are client-side network interruptions (mobile flap, page navigating away
      // mid-poll, DNS hiccup) — not actionable on our side. Edge-side blocks return an
      // HTTP response, so this filter cannot silence real server regressions. Scoped
      // via the `endpoint` tag set in ConnectedContext so unrelated fetch failures
      // elsewhere in the app still reach Sentry. One substring per browser engine:
      // Chromium "Failed to fetch", WebKit "Load failed", Gecko "NetworkError when
      // attempting to fetch resource.".
      const endpointTag = event.tags?.endpoint;
      const isNetworkLayerFetchError =
        message.includes('Failed to fetch') ||
        message.includes('Load failed') ||
        message.includes('NetworkError when attempting to fetch');
      if (
        isNetworkLayerFetchError &&
        (endpointTag === 'ip-status' || endpointTag === 'terms-check')
      ) {
        return null;
      }

      // Drop unhandled wallet provider rejections from EIP-1193 providers.
      // These are plain-object rejections we can't prevent from our side:
      //   - 4001: user rejected request during Wagmi auto-reconnect (WEBAPP-B).
      //   - -32601: JSON-RPC "Method not found" — wagmi/viem/RainbowKit
      //     speculatively probe optional methods (EIP-5792 capabilities,
      //     wallet_watchAsset, etc.) and wallets that don't implement them
      //     reject with this code.
      const extraData = (event.extra as Record<string, unknown> | undefined)?.__serialized__ as
        | Record<string, unknown>
        | undefined;
      if (
        event.exception?.values?.some(v =>
          v.value?.includes('Object captured as promise rejection with keys')
        ) &&
        (extraData?.code === 4001 || extraData?.code === -32601)
      ) {
        return null;
      }

      return event;
    }
  });
  hasInitializedSentry = true;
}
