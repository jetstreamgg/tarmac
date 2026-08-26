/// <reference types="vite/client" />

declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_SENTRY_ENVIRONMENT?: string;
  readonly VITE_SENTRY_RELEASE?: string;
  readonly VITE_SENTRY_DEBUG?: string;
  readonly VITE_ENV_NAME?: string;
  readonly VITE_CF_PAGES_COMMIT_SHA?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  /**
   * E2E seam (APP-502): the e2e server is built with VITE_SKIP_AUTH_CHECK=true
   * (one server for the whole suite), so a spec exercising the compliance
   * surface re-enables the checks per-page via an init script instead of a
   * rebuild. Read by `shouldSkipAuthChecks` (src/lib/authCheck.ts), written by
   * the e2e mocks (src/test/e2e/mock-terms-gate.ts). Cancels only the env-var
   * skip, never the private-deployment one, and is inert in production builds.
   */
  __FORCE_AUTH_CHECKS__?: boolean;
}
