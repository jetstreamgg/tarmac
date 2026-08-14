import type posthog from 'posthog-js';
import { reportError } from '@/modules/sentry/reportError';

// ── Event Names ──────────────────────────────────────────────────────────────

export const AppEvents = {
  WIDGET_SELECTED: 'app_widget_selected',
  TRANSACTION_STARTED: 'app_widget_flow_started',
  TRANSACTION_COMPLETED: 'app_widget_flow_completed',
  WIDGET_REVIEW_VIEWED: 'app_widget_review_viewed',
  VPN_CHECK_COMPLETED: 'app_vpn_check_completed',
  VPN_BLOCKED_PAGE_VIEW: 'app_vpn_blocked_page_view',
  WALLET_CONNECTED: 'app_wallet_connected',
  WALLET_DISCONNECTED: 'app_wallet_disconnected',
  ROUTE_REDIRECTED: 'app_route_redirected'
} as const;

// ── Types ────────────────────────────────────────────────────────────────────

// 'link' = fallback for pathname-changing pushes no click handler claimed (in-page links, buttons).
export type SelectionMethod = 'header_nav' | 'mobile_drawer' | 'deeplink' | 'card' | 'link';
export type RedirectReason =
  | 'module_unavailable'
  | 'unknown_reward'
  | 'unknown_vault'
  | 'unknown_market'
  | 'market_matured'
  | 'not_found';
export type TxStatus = 'success' | 'error' | 'cancelled';
export type VpnCheckResult = 'allowed' | 'vpn_blocked' | 'region_blocked' | 'error' | 'unknown';
export type BlockReason =
  'vpn_detected' | 'restricted_region' | 'address_restricted' | 'network_error' | 'auth_error' | 'unknown';
export type Viewport = 'mobile' | 'tablet' | 'desktop';

// ── Helpers ──────────────────────────────────────────────────────────────────

export function getViewport(): Viewport {
  if (typeof window === 'undefined') return 'desktop';
  const w = window.innerWidth;
  if (w < 768) return 'mobile';
  if (w < 1024) return 'tablet';
  return 'desktop';
}

/**
 * Try/catch wrapper for PostHog capture calls.
 * Analytics should never break the app.
 */
export function safeCapture(
  ph: typeof posthog | null | undefined,
  event: string,
  properties?: Record<string, unknown>
): void {
  try {
    ph?.capture(event, properties);
  } catch (error) {
    reportAnalyticsError(`safeCapture:${event}`, error);
  }
}

/**
 * Report analytics errors without letting analytics failures break the app.
 */
export function reportAnalyticsError(context: string, error: unknown): void {
  console.warn(`[Analytics] ${context}:`, error);
  reportError(error, {
    module: 'analytics',
    flow: 'safe-capture',
    action: context,
    type: 'analytics_error',
    level: 'warning'
  });
}

// ── Amounts ──────────────────────────────────────────────────────────────────

/**
 * Sign convention for the `amount` property on tx events: flows that remove
 * funds (withdraw, revert) report negative amounts, everything else positive.
 * Flows that self-sign inside their data blob (stake, pendle redeem) bypass this.
 */
export function signedAmount(
  amount: number | null | undefined,
  flow: string | null | undefined
): number | undefined {
  if (amount == null) return undefined;
  return flow === 'withdraw' || flow === 'revert' ? -Math.abs(amount) : Math.abs(amount);
}
