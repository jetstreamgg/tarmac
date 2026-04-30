# Sentry Integration Plan — `tarmac/apps/webapp`

Based on existing implementations in `api-workers` (`@sentry/cloudflare@^10`) and `marketing-page` (`@sentry/nextjs@^10`).

---

## 1. Install Dependencies

This workspace uses `catalogMode: strict` in `pnpm-workspace.yaml`, so all dependency versions must be declared in the `catalog:` section first, then referenced as `"catalog:"` in the app's `package.json`.

**Step 1a — Add to `tarmac/pnpm-workspace.yaml` under `catalog:`:**

```yaml
catalog:
  # ... existing entries ...
  '@sentry/react': ^10.35.0
  '@sentry/vite-plugin': ^3.2.0
```

**Step 1b — Add to `tarmac/apps/webapp/package.json`:**

```json
"dependencies": {
  "@sentry/react": "catalog:"
},
"devDependencies": {
  "@sentry/vite-plugin": "catalog:"
}
```

**Step 1c — Install:**

```bash
cd tarmac && pnpm install
```

- **`@sentry/react`** — React SDK with error boundary integration, performance tracing, and session replay
- **`@sentry/vite-plugin`** — Source map upload during build (mirrors marketing-page's `deleteSourcemapsAfterUpload` pattern)

---

## 2. Environment Variables

Add to `.env.example`:

```env
# Sentry
VITE_SENTRY_DSN=
VITE_SENTRY_ENVIRONMENT=development
VITE_SENTRY_RELEASE=
VITE_SENTRY_DEBUG=

# Build-time only (CI/CD) — not prefixed with VITE_
SENTRY_ORG=
SENTRY_PROJECT=
SENTRY_AUTH_TOKEN=
```

**Notes:**

- `VITE_SENTRY_DSN` is public (client-side), consistent with marketing-page's `NEXT_PUBLIC_SENTRY_DSN`
- Build-time variables (`SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`) are used by the Vite plugin for source map uploads and should NOT be prefixed with `VITE_`
- `VITE_SENTRY_ENVIRONMENT` defaults to `'development'` to match the existing `VITE_ENV_NAME` pattern

---

## 3. Create Sentry Configuration Module

Create `src/modules/sentry/init.ts`:

```typescript
import * as Sentry from '@sentry/react';
import { useEffect } from 'react';
import { useLocation, useNavigationType, createRoutesFromChildren, matchRoutes } from 'react-router-dom';

const isProd = import.meta.env.VITE_SENTRY_ENVIRONMENT === 'production';
const isDebug = !!import.meta.env.VITE_SENTRY_DEBUG;
const shouldSendDevEvents = isProd || isDebug;

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || 'development',
    release: import.meta.env.VITE_SENTRY_RELEASE || import.meta.env.VITE_CF_PAGES_COMMIT_SHA,
    debug: !isProd && isDebug,

    // Performance — mirrors marketing-page strategy in production, but stays
    // fully disabled in local/dev unless VITE_SENTRY_DEBUG is explicitly set.
    // beforeSend only filters error events; it does NOT block transactions.
    tracesSampleRate: !shouldSendDevEvents ? 0 : isProd ? 0.1 : 1.0,

    // Session Replay — sample rates configured here, but the replay integration
    // itself is NOT added until the user grants consent (see Step 9).
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,

    integrations: [
      Sentry.browserTracingIntegration(),
      // NOTE: replayIntegration is added dynamically in Step 9 after consent.
      // Do NOT include it here — shipping replay before consent violates the
      // app's existing consent-gated analytics pattern (see PostHogProvider).
      Sentry.reactRouterV6BrowserTracingIntegration({
        useEffect,
        useLocation,
        useNavigationType,
        createRoutesFromChildren,
        matchRoutes
      })
    ],

    // Filter noisy errors — from marketing-page's beforeSend
    beforeSend(event) {
      // Don't send error events in development unless debug is enabled
      if (!shouldSendDevEvents) return null;

      const message = event.exception?.values?.[0]?.value || '';
      const stack = event.exception?.values?.[0]?.stacktrace?.frames || [];

      // Ignore browser extension errors
      if (stack.some(frame => /^(chrome|moz)-extension:\/\//.test(frame.filename || ''))) {
        return null;
      }

      // Ignore common network noise
      const ignorePatterns = [
        'Network Error',
        'Failed to fetch',
        'Load failed',
        'AbortError',
        'The operation was aborted'
      ];
      if (ignorePatterns.some(pattern => message.includes(pattern))) {
        return null;
      }

      return event;
    }
  });
}
```

**Key decisions:**

- Matches marketing-page's sampling strategy (10% prod / 100% dev for traces)
- Session replay is **not** initialized here — it is added dynamically after consent (Step 9)
- Same error filtering for browser extensions and network noise
- Same dev-suppression pattern (no errors or traces unless `VITE_SENTRY_DEBUG` is set)
- Uses `VITE_CF_PAGES_COMMIT_SHA` as release fallback (already exists in the app)
- Uses React Router **v6** integration (`reactRouterV6BrowserTracingIntegration`) since the app is on `react-router-dom@^6.30.3`

---

## 4. Initialize Sentry in Entry Point

Modify `src/pages/main.tsx` — Sentry must initialize **before** React renders:

```typescript
// At the very top of main.tsx, before other imports
import { initSentry } from '../modules/sentry/init';
initSentry();

// ... rest of existing imports and code
```

This mirrors the marketing-page pattern where Sentry is initialized at the earliest possible point.

---

## 5. Integrate with React Router

The webapp uses `react-router-dom@^6.30.3`, so we need the **v6** Sentry integration (not v7).

In `src/pages/router.tsx`, wrap the router creation:

```typescript
import * as Sentry from '@sentry/react';

// Wrap existing createBrowserRouter call with Sentry's v6 wrapper
const sentryCreateBrowserRouter = Sentry.wrapCreateBrowserRouterV6(createBrowserRouter);
const router = sentryCreateBrowserRouter(routes);
```

This automatically captures navigation spans as performance transactions, similar to marketing-page's `onRouterTransitionStart`.

> **Note:** The `reactRouterV6BrowserTracingIntegration` in Step 3 and `wrapCreateBrowserRouterV6` here work together — the integration provides the hooks, and the wrapper instruments the router instance.

---

## 6. Upgrade Error Boundaries with Sentry

### 6a. Top-Level Error Boundary (`src/modules/layout/components/ErrorBoundary.tsx`)

Replace the existing `console.error` with Sentry capture:

```typescript
import * as Sentry from '@sentry/react';

// In componentDidCatch or the error handler:
componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
  Sentry.captureException(error, {
    contexts: { react: { componentStack: errorInfo.componentStack } },
  });
  console.error({ error, errorInfo }); // Keep console logging
}
```

**Alternative approach:** Replace the custom `ErrorBoundary` entirely with `Sentry.ErrorBoundary`:

```typescript
import * as Sentry from '@sentry/react';

// In main.tsx, replace:
<ErrorBoundary>
// With:
<Sentry.ErrorBoundary fallback={<Error />} showDialog={false}>
```

This automatically captures exceptions with full React component stack traces — consistent with the marketing-page's `global-error.tsx` pattern.

### 6b. Router Error Page (`src/pages/ErrorPage.tsx`)

Add Sentry capture to the router error page:

```typescript
import * as Sentry from '@sentry/react';
import { useRouteError } from 'react-router-dom';

export function ErrorPage() {
  const error = useRouteError();

  useEffect(() => {
    Sentry.captureException(error, {
      tags: { type: 'route_error' }
    });
  }, [error]);

  // ... existing UI
}
```

### 6c. Analytics Error Boundary (`src/modules/analytics/constants.ts`)

Replace the `console.warn` in `reportAnalyticsError()` (addresses the existing TODO).

**Important:** The existing signature is `reportAnalyticsError(context: string, error: unknown)` — context comes first. Callers throughout the codebase (e.g., `safeCapture`, `useWidgetAnalytics`, `AnalyticsErrorBoundary`) already use this order. Keep the signature as-is to avoid breaking callers:

```typescript
import * as Sentry from '@sentry/react';

export function reportAnalyticsError(context: string, error: unknown): void {
  console.warn(`[Analytics] ${context}:`, error);
  Sentry.captureException(error, {
    level: 'warning',
    tags: { type: 'analytics_error', context }
  });
}
```

This directly resolves the TODO comment at `src/modules/analytics/constants.ts:86`.

---

## 7. Add Contextual Error Capturing

Following the api-workers tagging pattern, add Sentry captures in critical areas:

### 7a. API/RPC Errors

In hooks or services that call external APIs (RPC providers, auth endpoints, chatbot API):

```typescript
Sentry.captureException(error, {
  tags: { type: 'api_error', endpoint: 'rpc_mainnet' }
});
```

### 7b. Wallet Connection Errors

```typescript
Sentry.captureException(error, {
  tags: { type: 'wallet_error', action: 'connect' }
});
```

### 7c. Transaction Errors

```typescript
Sentry.captureException(error, {
  tags: { type: 'tx_error', module: 'trade' }
});
```

**Tagging strategy** (consistent with both existing projects):

- `type` — Error category (`api_error`, `wallet_error`, `tx_error`, `config_error`, `analytics_error`)
- `endpoint` / `module` / `action` — Specific context for filtering in the Sentry dashboard

---

## 8. Vite Plugin & CSP Configuration

### 8a. Source Map Upload Plugin

Modify `vite.config.ts` for source map uploads:

```typescript
import { sentryVitePlugin } from '@sentry/vite-plugin';

export default defineConfig({
  build: {
    sourcemap: true // Required for Sentry source maps
  },
  plugins: [
    // ... existing plugins

    // Add Sentry plugin LAST (runs after build)
    sentryVitePlugin({
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      sourcemaps: {
        deleteAfterUpload: true // Mirrors marketing-page's deleteSourcemapsAfterUpload
      },
      // Only upload in CI/production builds
      disable: !process.env.SENTRY_AUTH_TOKEN
    })
  ]
});
```

**Notes:**

- Source maps are uploaded then deleted (matches marketing-page pattern)
- Plugin is disabled when `SENTRY_AUTH_TOKEN` is missing (local dev)
- `sourcemap: true` in build config is required for the plugin to work

### 8b. Content Security Policy Update

The app injects a strict CSP via a `<meta>` tag in `vite.config.ts` (line 27). Without updating it, Sentry's error reporting and replay will be blocked by the browser.

Add Sentry domains to the existing `CONTENT_SECURITY_POLICY` string in `vite.config.ts`:

```
connect-src 'self'
  ...existing entries...
  https://*.ingest.sentry.io;      ← error & performance event delivery
```

If Session Replay is enabled (Step 9), also add:

```
worker-src 'self' blob:;           ← Replay uses a Web Worker
child-src 'self' blob:;            ← Older Safari falls back to child-src for workers
```

This mirrors the marketing-page's CSP configuration where `https://*.sentry.io` and `https://*.ingest.sentry.io` are whitelisted.

> **Why this matters:** Without `connect-src` for Sentry's ingest endpoint, the browser will silently block all `fetch()` calls from the SDK. Errors will appear captured in devtools but never reach the Sentry dashboard.

---

## 9. Consent-Gated Session Replay

Session Replay records user interactions and **must not** start before consent. The app already enforces this pattern — `PostHogProvider.tsx` switches between memory-only and persistent storage based on the `sky_consent` cookie.

Replay is intentionally **omitted** from `Sentry.init()` in Step 3. It is added dynamically only after the user grants consent, and it must be explicitly stopped again if consent is later revoked:

```typescript
import * as Sentry from '@sentry/react';

let replayEnabled = false;

// In the consent change handler (CookieConsentProvider or consentStorage)
function onSentryReplayConsentChange(hasConsent: boolean) {
  if (hasConsent && !replayEnabled) {
    Sentry.addIntegration(
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true
      })
    );
    replayEnabled = true;
    return;
  }

  if (!hasConsent && replayEnabled) {
    Sentry.getReplay()?.stop();
    replayEnabled = false;
  }
}
```

Recommended wiring:

- When the user accepts analytics cookies, call `onSentryReplayConsentChange(true)`.
- When the user disables analytics cookies later in the same session, call `onSentryReplayConsentChange(false)` so replay stops immediately.
- If the app starts with consent already granted in the cookie, call `onSentryReplayConsentChange(true)` during Sentry bootstrap after `initSentry()`.

**What runs without consent:**

- Error capturing (`captureException`) — no PII, only stack traces
- Performance tracing (`browserTracingIntegration`) — anonymized route data

**What requires consent:**

- Session Replay (`replayIntegration`) — records DOM snapshots, user interactions

This matches the marketing-page's privacy settings (`maskAllText: true`, `blockAllMedia: true`) and aligns with the existing `PostHogProvider` consent flow.

> **Important:** This step must ship in the same PR as Steps 1–6 (core integration). It is NOT safe to defer to a follow-up PR, since the `replaysSessionSampleRate` and `replaysOnErrorSampleRate` config values in Step 3 would otherwise be inert but misleading, and consent revocation must be handled from day one.

---

## 10. Testing Setup

Add Sentry mocks for Vitest (consistent with api-workers' mock pattern):

Create `src/modules/sentry/__mocks__/@sentry/react.ts` or add to `vitest.config.ts`:

```typescript
// In vitest.config.ts or a setup file
vi.mock('@sentry/react', () => ({
  init: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => children,
  browserTracingIntegration: vi.fn(() => ({})),
  replayIntegration: vi.fn(() => ({})),
  reactRouterV6BrowserTracingIntegration: vi.fn(() => ({})),
  wrapCreateBrowserRouterV6: (fn: Function) => fn,
  withScope: vi.fn((cb: Function) => cb({ setTag: vi.fn(), setExtra: vi.fn() })),
  addIntegration: vi.fn()
}));
```

---

## Implementation Order

| Step | Task                          | Files Modified                                    | Risk   |
| ---- | ----------------------------- | ------------------------------------------------- | ------ |
| 1    | Add to pnpm catalog & install | `pnpm-workspace.yaml`, `apps/webapp/package.json` | Low    |
| 2    | Add env vars                  | `.env.example`, `.env`                            | Low    |
| 3    | Create Sentry init module     | `src/modules/sentry/init.ts` (new)                | Low    |
| 4    | Initialize in entry point     | `src/pages/main.tsx`                              | Low    |
| 5    | Router v6 integration         | `src/pages/router.tsx`                            | Low    |
| 6a   | Error boundary integration    | `src/modules/layout/components/ErrorBoundary.tsx` | Low    |
| 6b   | Router error page             | `src/pages/ErrorPage.tsx`                         | Low    |
| 6c   | Analytics error reporting     | `src/modules/analytics/constants.ts`              | Low    |
| 7    | Contextual captures           | Various hooks/services                            | Medium |
| 8a   | Vite source map plugin        | `vite.config.ts`                                  | Medium |
| 8b   | CSP update                    | `vite.config.ts` (CSP string)                     | Medium |
| 9    | Consent-gated replay          | Consent-related files                             | Medium |
| 10   | Test mocks                    | `vitest.config.ts` or setup file                  | Low    |

**Recommended approach:** Steps 1–6 + 8b + 9 as one PR (core integration with CSP and consent — these are not deferrable), steps 7 + 8a as a follow-up PR (contextual captures and source map uploads), step 10 alongside each PR.

---

## Summary of Patterns Adopted

| Pattern                                | Source                           | Applied To Webapp                              |
| -------------------------------------- | -------------------------------- | ---------------------------------------------- |
| `captureException` with tags           | api-workers                      | Error boundaries, API calls, wallet errors     |
| Dev event suppression via `beforeSend` | marketing-page                   | `init.ts` beforeSend hook                      |
| 10% prod / 100% dev trace sampling     | marketing-page                   | `tracesSampleRate`                             |
| Consent-gated session replay           | marketing-page + PostHogProvider | `addIntegration` after consent                 |
| Session replay privacy masking         | marketing-page                   | `maskAllText`, `blockAllMedia`                 |
| Browser extension error filtering      | marketing-page                   | `beforeSend` filter                            |
| Network error filtering                | marketing-page                   | `beforeSend` filter                            |
| CSP whitelisting for Sentry endpoints  | marketing-page                   | `connect-src`, `worker-src` in CSP             |
| Source map upload + delete             | marketing-page                   | Vite plugin config                             |
| Error level for non-critical issues    | marketing-page                   | `level: 'warning'` for analytics/config errors |
| Sentry mock in tests                   | api-workers                      | Vitest mock setup                              |
| pnpm catalog for dependency versions   | tarmac convention                | `pnpm-workspace.yaml` catalog entry            |
