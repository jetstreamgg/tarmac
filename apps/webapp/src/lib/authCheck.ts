import { IS_PRODUCTION_ENV } from '@/lib/constants';
import { isPrivateDeployment } from '@/lib/isPrivateDeployment';

declare global {
  interface Window {
    /**
     * E2E seam (APP-502): the e2e server is built with
     * VITE_SKIP_AUTH_CHECK=true (one server for the whole suite), so a spec
     * exercising the compliance surface re-enables the checks per-page via an
     * init script instead of a rebuild. Cancels only the env-var skip, never
     * the private-deployment one, and is inert in production builds.
     */
    __FORCE_AUTH_CHECKS__?: boolean;
  }
}

/**
 * The dev/e2e bypass for the whole compliance surface: connect-time screening,
 * the browse-gate terms check, and the pre-transaction gate (screening + the
 * terms signature) all skip together. One expression, shared by every gate, so
 * an environment can't end up half-open — browsing freely but stuck at a
 * Confirm that demands a signature its mocks can't produce.
 */
export const shouldSkipAuthChecks = (): boolean => {
  if (isPrivateDeployment()) return true;
  // Production kill-switch: past this line nothing can alter the verdict —
  // neither the env flag nor the e2e seam exists in a production build.
  if (IS_PRODUCTION_ENV) return false;
  if (typeof window !== 'undefined' && window.__FORCE_AUTH_CHECKS__ === true) return false;
  return import.meta.env.VITE_SKIP_AUTH_CHECK === 'true';
};

/** The compliance API origin (`/ip/status`, `/address/status`). */
export const getAuthUrl = (): string => import.meta.env.VITE_AUTH_URL || 'https://staging-api.sky.money';
