import { SavingsAction, SavingsFlow, SavingsScreen } from '@/widgets/SavingsWidget/lib/constants';
import { PendleAction, PendleFlow, PendleScreen } from '@/widgets/PendleWidget/lib/constants';
import { VaultAction, VaultFlow, VaultScreen } from '@/widgets/VaultWidget/lib/constants';
import { BalancesFlow } from '@/widgets/BalancesWidget/constants';
import { Token } from '@/hooks';
import { TxStatus, NotificationType, InitialAction, InitialFlow, InitialScreen } from '../constants';
import { WidgetAnalyticsEvent } from './analyticsEvents';

// Survivors of the deleted PsmConversionWidget (superseded by the E2 /convert
// page): the flow/action/screen values stay in the shared unions because the
// legacy widget-state contract is frozen until the remaining widgets migrate.
export enum PsmConversionFlow {
  CONVERT = 'convert'
}

export enum PsmConversionAction {
  APPROVE = 'approve',
  CONVERT = 'convert'
}

export enum PsmConversionScreen {
  ACTION = 'action',
  REVIEW = 'review',
  TRANSACTION = 'transaction'
}

export type WidgetFlow =
  InitialFlow | BalancesFlow | SavingsFlow | PsmConversionFlow | VaultFlow | PendleFlow;

export type WidgetAction = InitialAction | SavingsAction | PsmConversionAction | VaultAction | PendleAction;

export type WidgetScreen = InitialScreen | SavingsScreen | PsmConversionScreen | VaultScreen | PendleScreen;

export type WidgetState = {
  flow: WidgetFlow | null;
  action: WidgetAction | null;
  screen: WidgetScreen | null;
};

type Amount = {
  amount?: string;
};

type Flow = {
  flow?: WidgetFlow;
};

type BalancesWidgetState = Flow;

type SavingsWidgetState = Amount & Flow;

export type ExternalWidgetState = BalancesWidgetState & SavingsWidgetState;

export type WidgetMessage = {
  title: string;
  description: string;
  status: TxStatus;
  type?: NotificationType;
};

export type OnNotificationCallback = (message: WidgetMessage) => void;

export type OnAnalyticsEventCallback = (event: WidgetAnalyticsEvent) => void;

export type WidgetStateChangeParams = {
  hash?: string;
  txStatus: TxStatus;
  widgetState: WidgetState;
  originToken?: string;
  targetToken?: string;
  executedBuyAmount?: string;
  executedSellAmount?: string;
  displayToken?: Token;
  originAmount?: string;
};

export type WidgetProps = {
  rightHeaderComponent?: React.ReactElement;
  externalWidgetState?: ExternalWidgetState;
  onStateValidated?: (state: ExternalWidgetState | undefined) => void;
  onWidgetStateChange?: (params: WidgetStateChangeParams) => void;
  onCustomNavigation?: () => void;
  customNavigationLabel?: string;
  disallowedFlow?: WidgetFlow;
};
