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
