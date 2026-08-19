import posthog from 'posthog-js';
import { POSTHOG_ENABLED } from '../PostHogProvider';
import { AppEvents, getViewport, safeCapture, type RedirectReason } from '../constants';

let lastEmission: { key: string; at: number } | null = null;

/**
 * app_route_redirected: involuntary traffic that today inflates destination
 * pageviews (APP-444 A7). Module-level (no hook) so route beforeLoad guards
 * can emit outside React; the identical-event window absorbs StrictMode
 * double-run effects.
 */
export function trackRouteRedirected({
  fromPath,
  toPath,
  reason
}: {
  fromPath: string;
  toPath: string;
  reason: RedirectReason;
}): void {
  if (!POSTHOG_ENABLED) return;
  const key = `${fromPath}>${toPath}:${reason}`;
  const now = Date.now();
  if (lastEmission && lastEmission.key === key && now - lastEmission.at < 500) return;
  lastEmission = { key, at: now };
  safeCapture(posthog, AppEvents.ROUTE_REDIRECTED, {
    from_path: fromPath,
    to_path: toPath,
    reason,
    viewport: getViewport()
  });
}
