import type {
  AppEvents,
  SelectionMethod,
  TxStatus,
  Viewport,
  VpnCheckResult,
  BlockReason,
  RedirectReason,
  DisconnectSource,
  ConnectReason,
  ConnectMethod,
  GatedActionOutcome,
  NetworkSwitchSource,
  NetworkSwitchStatus,
  AutoSwitchTrigger,
  PromoId
} from './constants';
import type { PsmConversionDisabledReason } from '@/modules/convert/hooks/usePsmConversion.helpers';
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

export interface WalletDisconnectedProps extends WalletEventProps {
  disconnect_source: DisconnectSource;
}

export interface ConnectModalOpenedProps extends CommonEventProps {
  connect_reason: ConnectReason;
}

export interface WalletConnectAttemptProps extends CommonEventProps {
  connector_name: string;
  method: ConnectMethod;
}

export interface GatedActionResolvedProps extends CommonEventProps {
  outcome: GatedActionOutcome;
  connect_reason: ConnectReason;
}

export interface NetworkSwitchRequestedProps extends CommonEventProps {
  source: NetworkSwitchSource;
  from_chain_id: number;
  to_chain_id: number;
  to_chain_name: string;
}

export interface NetworkSwitchCompletedProps extends NetworkSwitchRequestedProps {
  status: NetworkSwitchStatus;
}

export interface NetworkAutoSwitchedProps extends CommonEventProps {
  trigger: AutoSwitchTrigger;
  from_chain_id: number;
  to_chain_id: number;
  to_chain_name: string;
  is_reconnect?: boolean;
}

export interface UnsupportedNetworkShownProps extends CommonEventProps {
  wallet_chain_id?: number;
}

export interface ConvertBlockedProps extends CommonEventProps {
  reason: PsmConversionDisabledReason;
  chain_id: number;
}

/** No flow_id: error surfaces are ambient, not part of a funnel. */
export interface ErrorBoundaryTriggeredProps {
  boundary_name: string;
  path: string;
  viewport: Viewport;
  destination?: Destination;
}

export interface PathViewedProps {
  path: string;
  viewport: Viewport;
  destination?: Destination;
}

/** No flow_id: impressions are ambient; the click's navigation starts the funnel. */
export interface PromoEventProps {
  promo_id: PromoId;
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
  app_wallet_disconnected: WalletDisconnectedProps;
  app_route_redirected: RouteRedirectedProps;
  app_connect_modal_opened: ConnectModalOpenedProps;
  app_wallet_connect_attempted: WalletConnectAttemptProps;
  app_wallet_connect_rejected: WalletConnectAttemptProps;
  app_gated_action_resolved: GatedActionResolvedProps;
  app_network_switch_requested: NetworkSwitchRequestedProps;
  app_network_switch_completed: NetworkSwitchCompletedProps;
  app_network_auto_switched: NetworkAutoSwitchedProps;
  app_unsupported_network_shown: UnsupportedNetworkShownProps;
  app_error_boundary_triggered: ErrorBoundaryTriggeredProps;
  app_route_error_viewed: PathViewedProps;
  app_not_found_viewed: PathViewedProps;
  app_convert_blocked: ConvertBlockedProps;
  app_promo_impression: PromoEventProps;
  app_promo_clicked: PromoEventProps;
};

export type AppEventName = (typeof AppEvents)[keyof typeof AppEvents];

// Compile-time check: every event in the registry has a contract entry.
type MissingFromContract = Exclude<AppEventName, keyof AppEventContract>;
export const CONTRACT_COVERS_REGISTRY: [MissingFromContract] extends [never] ? true : MissingFromContract =
  true;
