import { SavingsAction, SavingsFlow, SavingsScreen } from '@/widgets/SavingsWidget/lib/constants';
import {
  UpgradeAction,
  UpgradeFlow,
  UpgradeScreen,
  upgradeTokens
} from '@/widgets/UpgradeWidget/lib/constants';
import { RewardsAction, RewardsFlow, RewardsScreen } from '@/widgets/RewardsWidget/lib/constants';
import { TradeAction, TradeFlow, TradeScreen } from '@/widgets/TradeWidget/lib/constants';
import { RewardContract } from '@jetstreamgg/sky-hooks';
import { TxStatus, NotificationType } from '../constants';
import { SealFlow } from '@widgets/widgets/SealModuleWidget/lib/constants';

export type WidgetState = {
  flow:
    | InitialFlow
    | BalancesFlow
    | SavingsFlow
    | UpgradeFlow
    | RewardsFlow
    | TradeFlow
    | StakeFlow
    | SealFlow;
  action: InitialAction | SavingsAction | UpgradeAction | RewardsAction | TradeAction;
  screen: InitialScreen | SavingsScreen | UpgradeScreen | RewardsScreen | TradeScreen;
};

type Amount = {
  amount?: string;
};

type Flow = {
  flow?: BalancesFlow | SavingsFlow | UpgradeFlow | RewardsFlow | TradeFlow | StakeFlow | SealFlow;
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

type WidgetMessage = {
  title: string;
  description: string;
  status: TxStatus;
  type?: NotificationType;
};

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
  onConnect?: () => void;
  locale?: string;
  addRecentTransaction?: (transaction: { hash: string; description: string }) => void;
  rightHeaderComponent?: React.ReactElement;
  externalWidgetState?: ExternalWidgetState;
  onStateValidated?: (state: State) => void;
  onNotification?: (message: WidgetMessage) => void;
  onWidgetStateChange?: (params: WidgetStateChangeParams) => void;
  onCustomNavigation?: () => void;
  customNavigationLabel?: string;
  enabled?: boolean;
  referralCode?: number;
  shouldReset?: boolean;
};
