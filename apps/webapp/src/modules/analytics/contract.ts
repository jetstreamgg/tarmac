import type {
  AppEvents,
  SelectionMethod,
  TxStatus,
  Viewport,
  VpnCheckResult,
  BlockReason,
  RedirectReason
} from './constants';
import type { WidgetErrorKind } from './lib/classifyTransactionError';
import type { Destination } from './lib/destination';

/**
 * Property contract for every first-class app event (APP-444).
 *
 * PARITY WARNING: `widget_name` and `tx_status` VALUES are load-bearing — ~60
 * PostHog insights filter on them. Do not rename or add values without checking
 * the insight inventory. Upgrade flows report widget_name 'convert', stUSDS
 * reports 'expert', Pendle reports 'fixed'.
 */

/** The closed set of widget_name values PostHog insights filter on. */
export type WidgetName = 'savings' | 'rewards' | 'convert' | 'stake' | 'vaults' | 'expert' | 'fixed';

interface CommonEventProps {
  viewport: Viewport;
  flow_id: string;
  /** Stamped at capture time by before_send; absent off-section. */
  destination?: Destination;
}

export interface WidgetSelectedProps extends CommonEventProps {
  widget_name: string;
  previous_widget: string;
  selection_method: SelectionMethod;
  chain_id: number;
  chain_name: string;
}

interface TransactionEventProps extends CommonEventProps {
  widget_name: string;
  chain_id: number;
  chain_name: string;
  wallet_address?: string;
  flow?: string;
  action?: string;
  timestamp: string;
  /** Per-widget module data blob — keys documented per module in the APP-444 payload parity spec. */
  [dataKey: string]: unknown;
}

export type TransactionStartedProps = TransactionEventProps;

export interface TransactionCompletedProps extends TransactionEventProps {
  tx_status: TxStatus;
  tx_hash?: string;
  /** Signed: negative iff flow is withdraw/revert (see signedAmount). */
  amount?: number;
  /** Error classification (present on tx_status error, and on wallet-reject cancels). */
  error_kind?: WidgetErrorKind;
  is_user_rejection?: boolean;
  error_code?: number;
  error_name?: string;
}

export type ReviewViewedProps = TransactionEventProps;

export interface WalletEventProps {
  wallet_name: string;
  viewport: Viewport;
  flow_id: string;
  destination?: Destination;
}

export interface VpnCheckCompletedProps {
  is_vpn: boolean | null;
  is_restricted_region: boolean | null;
  country_code: string | null;
  result: VpnCheckResult;
  viewport: Viewport;
}

export interface VpnBlockedPageViewProps {
  block_reason: BlockReason;
  country_code: string | null;
  viewport: Viewport;
}

/** No flow_id: redirects are ambient navigation, not part of a funnel. */
export interface RouteRedirectedProps {
  from_path: string;
  to_path: string;
  reason: RedirectReason;
  viewport: Viewport;
  destination?: Destination;
}

export type AppEventContract = {
  app_widget_selected: WidgetSelectedProps;
  app_widget_flow_started: TransactionStartedProps;
  app_widget_flow_completed: TransactionCompletedProps;
  app_widget_review_viewed: ReviewViewedProps;
  app_vpn_check_completed: VpnCheckCompletedProps;
  app_vpn_blocked_page_view: VpnBlockedPageViewProps;
  app_wallet_connected: WalletEventProps;
  app_wallet_disconnected: WalletEventProps;
  app_route_redirected: RouteRedirectedProps;
};

export type AppEventName = (typeof AppEvents)[keyof typeof AppEvents];

// Compile-time check: every event in the registry has a contract entry.
type MissingFromContract = Exclude<AppEventName, keyof AppEventContract>;
export const CONTRACT_COVERS_REGISTRY: [MissingFromContract] extends [never] ? true : MissingFromContract =
  true;
