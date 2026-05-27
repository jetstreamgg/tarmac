import { SavingsAction, SavingsFlow, SavingsScreen } from '@/widgets/SavingsWidget/lib/constants';
import {
  UpgradeAction,
  UpgradeFlow,
  UpgradeScreen,
  upgradeTokens
} from '@/widgets/UpgradeWidget/lib/constants';
import { RewardsAction, RewardsFlow, RewardsScreen } from '@/widgets/RewardsWidget/lib/constants';
import { TradeAction, TradeFlow, TradeScreen } from '@/widgets/TradeWidget/lib/constants';
import {
  PsmConversionAction,
  PsmConversionFlow,
  PsmConversionScreen
} from '@/widgets/PsmConversionWidget/lib/constants';
import { PendleAction, PendleFlow, PendleScreen } from '@/widgets/PendleWidget/lib/constants';
import { StakeAction, StakeFlow, StakeScreen } from '@/widgets/StakeModuleWidget/lib/constants';
import { StUSDSAction, StUSDSFlow, StUSDSScreen } from '@/widgets/StUSDSWidget/lib/constants';
import {
  MorphoVaultAction,
  MorphoVaultFlow,
  MorphoVaultScreen
} from '@/widgets/MorphoVaultWidget/lib/constants';
import { BalancesFlow } from '@/widgets/BalancesWidget/constants';
import { RewardContract, Token } from '@/hooks';
import { TxStatus, NotificationType, InitialAction, InitialFlow, InitialScreen } from '../constants';
import { WidgetAnalyticsEvent } from './analyticsEvents';

export type WidgetFlow =
  | InitialFlow
  | BalancesFlow
  | SavingsFlow
  | UpgradeFlow
  | RewardsFlow
  | TradeFlow
  | PsmConversionFlow
  | StakeFlow
  | StUSDSFlow
  | MorphoVaultFlow
  | PendleFlow;

export type WidgetAction =
  | InitialAction
  | SavingsAction
  | UpgradeAction
  | RewardsAction
  | TradeAction
  | PsmConversionAction
  | StakeAction
  | StUSDSAction
  | MorphoVaultAction
  | PendleAction;

export type WidgetScreen =
  | InitialScreen
  | SavingsScreen
  | UpgradeScreen
  | RewardsScreen
  | TradeScreen
  | PsmConversionScreen
  | StakeScreen
  | StUSDSScreen
  | MorphoVaultScreen
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

type RewardsWidgetState = Amount &
  Flow & {
    selectedRewardContract?: RewardContract;
  };

type StakeWidgetState = Amount & {
  urnIndex?: number;
  stakeTab?: StakeAction.LOCK | StakeAction.FREE;
};

export type ExternalWidgetState = BalancesWidgetState &
  UpgradeWidgetState &
  TradeWidgetState &
  SavingsWidgetState &
  RewardsWidgetState &
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
  shouldReset?: boolean;
  disallowedFlow?: WidgetFlow;
};
