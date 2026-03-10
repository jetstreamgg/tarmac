import type posthog from 'posthog-js';

// ── Event Names ──────────────────────────────────────────────────────────────

export const AppEvents = {
  WIDGET_SELECTED: 'app_widget_selected',
  CONVERT_MODULE_SELECTED: 'app_convert_module_selected',
  TRANSACTION_STARTED: 'app_widget_flow_started',
  TRANSACTION_COMPLETED: 'app_widget_flow_completed',
  WIDGET_REVIEW_VIEWED: 'app_widget_review_viewed',
  DETAILS_PANE_TOGGLED: 'app_details_pane_toggled',
  CHAT_PANE_TOGGLED: 'app_chat_pane_toggled',
  VPN_CHECK_COMPLETED: 'app_vpn_check_completed',
  VPN_BLOCKED_PAGE_VIEW: 'app_vpn_blocked_page_view',
  WALLET_CONNECTED: 'app_wallet_connected',
  WALLET_DISCONNECTED: 'app_wallet_disconnected'
} as const;

export const ChatEvents = {
  ENTRY_IMPRESSION: 'chat_entry_impression',
  SUGGESTED_QUESTIONS_SHOWN: 'chat_suggested_questions_shown',
  SUGGESTED_QUESTION_CLICKED: 'chat_suggested_question_clicked',
  MESSAGE_ATTEMPTED: 'chat_message_attempted',
  TERMS_PROMPTED: 'chat_terms_prompted',
  TERMS_ACCEPTED: 'chat_terms_accepted',
  TERMS_DECLINED: 'chat_terms_declined',
  TERMS_ABANDONED: 'chat_terms_abandoned',
  MESSAGE_SENT: 'chat_message_sent',
  RESPONSE_RECEIVED: 'chat_response_received',
  WORKER_ERROR: 'chat_worker_error',
  INTENT_CLICKED: 'chat_intent_clicked',
  FEEDBACK_SUBMITTED: 'chat_feedback_submitted'
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
export type InputLengthBucket = '1_20' | '21_80' | '81_200' | '200_plus';

// ── Helpers ──────────────────────────────────────────────────────────────────

export function getInputLengthBucket(length: number): InputLengthBucket {
  if (length <= 20) return '1_20';
  if (length <= 80) return '21_80';
  if (length <= 200) return '81_200';
  return '200_plus';
}

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
 * Report analytics errors.
 *
 * TODO: Replace console.warn with an error monitoring service so analytics
 * failures are surfaced in production without breaking the app.
 * Only this function needs to change — all analytics code already calls it.
 */
export function reportAnalyticsError(context: string, error: unknown): void {
  console.warn(`[Analytics] ${context}:`, error);
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
