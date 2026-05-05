import type posthog from 'posthog-js';
import { reportError } from '@/modules/sentry/reportError';

// ── Event Names ──────────────────────────────────────────────────────────────

export const AppEvents = {
  WIDGET_SELECTED: 'app_widget_selected',
  CONVERT_MODULE_SELECTED: 'app_convert_module_selected',
  TRANSACTION_STARTED: 'app_widget_flow_started',
  TRANSACTION_COMPLETED: 'app_widget_flow_completed',
  WIDGET_REVIEW_VIEWED: 'app_widget_review_viewed',
  DETAILS_PANE_TOGGLED: 'app_details_pane_toggled',
  VPN_CHECK_COMPLETED: 'app_vpn_check_completed',
  VPN_BLOCKED_PAGE_VIEW: 'app_vpn_blocked_page_view',
  WALLET_CONNECTED: 'app_wallet_connected',
  WALLET_DISCONNECTED: 'app_wallet_disconnected'
} as const;

// ── Types ────────────────────────────────────────────────────────────────────

export type SelectionMethod = 'sidebar_tab' | 'mobile_drawer' | 'deeplink' | 'card';
export type TxStatus = 'success' | 'error' | 'cancelled';
export type ErrorContext = string;
export type VpnCheckResult = 'allowed' | 'vpn_blocked' | 'region_blocked' | 'error' | 'unknown';
export type BlockReason =
  | 'vpn_detected'
  | 'restricted_region'
  | 'address_restricted'
  | 'network_error'
  | 'auth_error'
  | 'unknown';
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

// ── Withdrawal Flows ────────────────────────────────────────────────────────
// Flows where the user is removing funds — input_amount should be negative.

const WITHDRAWAL_FLOWS: Record<string, Set<string>> = {
  savings: new Set(['withdraw']),
  rewards: new Set(['withdraw']),
  stusds: new Set(['withdraw'])
};

// Stake/Seal use tab params instead of flow to determine direction
const WITHDRAWAL_TABS = new Set(['free']);

export function isWithdrawalFlow(
  widget: string | null,
  expertModule: string | null,
  flow: string | null,
  stakeTab: string | null,
  sealTab: string | null
): boolean {
  if (!widget) return false;
  const flowWidget = widget === 'expert' ? expertModule : widget;
  if (flow && flowWidget && WITHDRAWAL_FLOWS[flowWidget]?.has(flow)) return true;
  if (widget === 'stake' && stakeTab && WITHDRAWAL_TABS.has(stakeTab)) return true;
  if (widget === 'seal' && sealTab && WITHDRAWAL_TABS.has(sealTab)) return true;
  return false;
}
