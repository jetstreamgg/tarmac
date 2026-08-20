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
  ROUTE_REDIRECTED: 'app_route_redirected',
  CONNECT_MODAL_OPENED: 'app_connect_modal_opened',
  WALLET_CONNECT_ATTEMPTED: 'app_wallet_connect_attempted',
  WALLET_CONNECT_REJECTED: 'app_wallet_connect_rejected',
  GATED_ACTION_RESOLVED: 'app_gated_action_resolved',
  NETWORK_SWITCH_REQUESTED: 'app_network_switch_requested',
  NETWORK_SWITCH_COMPLETED: 'app_network_switch_completed',
  NETWORK_AUTO_SWITCHED: 'app_network_auto_switched',
  UNSUPPORTED_NETWORK_SHOWN: 'app_unsupported_network_shown',
  ERROR_BOUNDARY_TRIGGERED: 'app_error_boundary_triggered',
  ROUTE_ERROR_VIEWED: 'app_route_error_viewed',
  NOT_FOUND_VIEWED: 'app_not_found_viewed',
  CONVERT_BLOCKED: 'app_convert_blocked',
  PROMO_IMPRESSION: 'app_promo_impression',
  PROMO_CLICKED: 'app_promo_clicked'
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
export type ErrorContext = string;
// A VPN stopped being a block outcome in APP-497 ('vpn_blocked'/'vpn_detected'
// retired): VPN users transact behind the per-transaction signature instead,
// and the `is_vpn` property on the events carries the fact.
export type VpnCheckResult = 'allowed' | 'region_blocked' | 'error' | 'unknown';
export type BlockReason =
  'restricted_region' | 'address_restricted' | 'network_error' | 'auth_error' | 'unknown';
export type Viewport = 'mobile' | 'tablet' | 'desktop';
export type DisconnectSource = 'wallet_drawer' | 'terms_declined' | 'terms_dismissed' | 'external';
/** Why the connect modal opened: the generic button, or the gated action that needed a wallet. */
export type ConnectReason =
  | 'connect_button'
  | 'upgrade_modal'
  | 'stake_open'
  | 'savings_supply'
  | 'vault_supply'
  | 'stusds_supply'
  | 'pendle_supply'
  | 'convert';
export type ConnectMethod = 'connect' | 'switch';
export type GatedActionOutcome = 'completed' | 'abandoned';
export type NetworkSwitchSource =
  'chain_modal' | 'network_toast' | 'unsupported_network_page' | 'portfolio_supply';
export type NetworkSwitchStatus = 'success' | 'rejected' | 'error';
export type AutoSwitchTrigger = 'connect' | 'url_param' | 'route_guard';
export type PromoId = 'allocate_stablecoins' | 'savings_tvl_simulate' | 'connect_wallet_card';

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
