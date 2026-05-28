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
import { RewardContract } from '@/hooks';
import { TxStatus, NotificationType } from '../constants';
import { SealFlow } from '@/widgets/SealModuleWidget/lib/constants';
import { WidgetAnalyticsEvent } from './analyticsEvents';

export type WidgetState = {
  flow:
    | InitialFlow
    | BalancesFlow
    | SavingsFlow
    | UpgradeFlow
    | RewardsFlow
    | TradeFlow
    | PsmConversionFlow
    | StakeFlow
    | SealFlow
    | PendleFlow;
  action:
    | InitialAction
    | SavingsAction
    | UpgradeAction
    | RewardsAction
    | TradeAction
    | PsmConversionAction
    | PendleAction;
  screen:
    | InitialScreen
    | SavingsScreen
    | UpgradeScreen
    | RewardsScreen
    | TradeScreen
    | PsmConversionScreen
    | StakeScreen
    | SealScreen
    | PendleScreen;
};

type Amount = {
  amount?: string;
};

type Flow = {
  flow?:
    | BalancesFlow
    | SavingsFlow
    | UpgradeFlow
    | RewardsFlow
    | TradeFlow
    | PsmConversionFlow
    | StakeFlow
    | SealFlow;
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

type SealWidgetState = Amount & {
  urnIndex?: number;
  sealTab?: SealAction.LOCK | SealAction.FREE;
};

export type ExternalWidgetState = BalancesWidgetState &
  UpgradeWidgetState &
  TradeWidgetState &
  SavingsWidgetState &
  RewardsWidgetState &
  StakeWidgetState &
  SealWidgetState;

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
  sealTab?: SealAction.LOCK | SealAction.FREE;
  urnIndex?: number;
};

export type WidgetProps = {
  rightHeaderComponent?: React.ReactElement;
  externalWidgetState?: ExternalWidgetState;
  onStateValidated?: (state: State) => void;
  onWidgetStateChange?: (params: WidgetStateChangeParams) => void;
  onCustomNavigation?: () => void;
  customNavigationLabel?: string;
  shouldReset?: boolean;
  disallowedFlow?:
    | BalancesFlow
    | SavingsFlow
    | UpgradeFlow
    | RewardsFlow
    | TradeFlow
    | PsmConversionFlow
    | StakeFlow
    | SealFlow;
};
