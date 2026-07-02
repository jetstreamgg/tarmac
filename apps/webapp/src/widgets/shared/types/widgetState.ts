import { SavingsAction, SavingsFlow, SavingsScreen } from '@/widgets/SavingsWidget/lib/constants';
import {
  UpgradeAction,
  UpgradeFlow,
  UpgradeScreen,
  upgradeTokens
} from '@/widgets/UpgradeWidget/lib/constants';
import { TradeAction, TradeFlow, TradeScreen } from '@/widgets/TradeWidget/lib/constants';
import {
  PsmConversionAction,
  PsmConversionFlow,
  PsmConversionScreen
} from '@/widgets/PsmConversionWidget/lib/constants';
import { PendleAction, PendleFlow, PendleScreen } from '@/widgets/PendleWidget/lib/constants';
import { StakeAction, StakeFlow, StakeScreen } from '@/widgets/StakeModuleWidget/lib/constants';
import { StUSDSAction, StUSDSFlow, StUSDSScreen } from '@/widgets/StUSDSWidget/lib/constants';
import { VaultAction, VaultFlow, VaultScreen } from '@/widgets/VaultWidget/lib/constants';
import { BalancesFlow } from '@/widgets/BalancesWidget/constants';
import { Token } from '@/hooks';
import { TxStatus, NotificationType, InitialAction, InitialFlow, InitialScreen } from '../constants';
import { WidgetAnalyticsEvent } from './analyticsEvents';

export type WidgetFlow =
  | InitialFlow
  | BalancesFlow
  | SavingsFlow
  | UpgradeFlow
  | TradeFlow
  | PsmConversionFlow
  | StakeFlow
  | StUSDSFlow
  | VaultFlow
  | PendleFlow;

export type WidgetAction =
  | InitialAction
  | SavingsAction
  | UpgradeAction
  | TradeAction
  | PsmConversionAction
  | StakeAction
  | StUSDSAction
  | VaultAction
  | PendleAction;

export type WidgetScreen =
  | InitialScreen
  | SavingsScreen
  | UpgradeScreen
  | TradeScreen
  | PsmConversionScreen
  | StakeScreen
  | StUSDSScreen
  | VaultScreen
  | PendleScreen;

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

type UpgradeWidgetState = Amount & {
  initialUpgradeToken?: keyof typeof upgradeTokens;
};

type TradeWidgetState = Amount & {
  token?: string;
  targetAmount?: string;
  targetToken?: string;
  timestamp?: number;
};

type SavingsWidgetState = Amount & Flow;

type StakeWidgetState = Amount & {
  urnIndex?: number;
  stakeTab?: StakeAction.LOCK | StakeAction.FREE;
};

export type ExternalWidgetState = BalancesWidgetState &
  UpgradeWidgetState &
  TradeWidgetState &
  SavingsWidgetState &
  StakeWidgetState;

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
  stakeTab?: StakeAction.LOCK | StakeAction.FREE;
  urnIndex?: number;
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
