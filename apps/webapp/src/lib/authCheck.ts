import { IS_PRODUCTION_ENV } from '@/lib/constants';
import { isPrivateDeployment } from '@/lib/isPrivateDeployment';

/**
 * The dev/e2e bypass for the whole compliance surface: connect-time screening,
 * the browse-gate terms check, and the pre-transaction gate (screening + the
 * terms signature) all skip together. One expression, shared by every gate, so
 * an environment can't end up half-open — browsing freely but stuck at a
 * Confirm that demands a signature its mocks can't produce.
 */
export const shouldSkipAuthChecks = (): boolean => {
  // E2E seam: the e2e server is built with VITE_SKIP_AUTH_CHECK=true (one
  // server for the whole suite), so a spec exercising the compliance surface
  // re-enables the checks per-page via an init script instead of a rebuild.
  // Cancels only the env-var skip, never the private-deployment one, and is
  // dead code in production builds.
  const forced =
    !IS_PRODUCTION_ENV &&
    typeof window !== 'undefined' &&
    (window as Window & { __FORCE_AUTH_CHECKS__?: boolean }).__FORCE_AUTH_CHECKS__ === true;
  return (
    (!forced && !IS_PRODUCTION_ENV && import.meta.env.VITE_SKIP_AUTH_CHECK === 'true') ||
    isPrivateDeployment()
  );
};

/** The compliance API origin (`/ip/status`, `/address/status`). */
export const getAuthUrl = (): string => import.meta.env.VITE_AUTH_URL || 'https://staging-api.sky.money';
