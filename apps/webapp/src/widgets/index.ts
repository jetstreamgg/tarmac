// Constants and types exported first so they resolve correctly when widget
// modules transitively re-enter this barrel mid-load via `from '@/widgets'`.
export { TxStatus, NotificationType } from './shared/constants';
export { WidgetAnalyticsEventType } from './shared/types/analyticsEvents';
export type { WidgetAnalyticsEvent } from './shared/types/analyticsEvents';
export type {
  WidgetState,
  WidgetProps,
  WidgetStateChangeParams,
  ExternalWidgetState
} from './shared/types/widgetState';
export * from './SavingsWidget/lib/constants';
export { VaultFlow, VaultAction, VaultScreen } from './VaultWidget/lib/constants';
export {
  PendleFlow,
  PendleAction,
  PendleScreen,
  PendleSlippageType,
  PENDLE_BUY_SLIPPAGE_STORAGE_KEY,
  PENDLE_SELL_SLIPPAGE_STORAGE_KEY,
  PENDLE_REDEEM_SLIPPAGE_STORAGE_KEY,
  PENDLE_DEFAULT_REDEEM_SLIPPAGE,
  PENDLE_HISTORY_REFRESH_MS
} from './PendleWidget/lib/constants';

export { VaultWidget } from './VaultWidget';
export type { VaultWidgetProps } from './VaultWidget';
export { PendleWidget } from './PendleWidget';
export type { PendleWidgetProps } from './PendleWidget';
export { usePendleTokens } from './PendleWidget/hooks/usePendleTokens';
export type { PendleTokens } from './PendleWidget/hooks/usePendleTokens';
export { usePendleSlippage } from './PendleWidget/hooks/usePendleSlippage';
export type { PendleSlippageMode } from './PendleWidget/hooks/usePendleSlippage';
export { usePendleUsdValue } from './PendleWidget/hooks/usePendleUsdValue';
export { pendleUsdValue, pendleNonPtLeg } from './PendleWidget/lib/pendleUsdValue';
export { PendleConfigMenu } from './PendleWidget/components/PendleConfigMenu';
export { pendleAnalyticsData } from './PendleWidget/lib/pendleAnalyticsData';
export type { PendleAnalyticsDataInput, PendleAnalyticsSide } from './PendleWidget/lib/pendleAnalyticsData';
export { TokenDropdown } from './shared/components/ui/token/TokenDropdown';
export { TransactionOverview } from './shared/components/ui/transaction/TransactionOverview';
export { VaultPoweredByBadge, MorphoVaultBadge } from './VaultWidget/components/MorphoVaultBadge';
export { MorphoRateBreakdownPopover } from './VaultWidget/components/MorphoRateBreakdownPopover';
export { SparkVaultRate } from './VaultWidget/components/SparkVaultRate';
export { defaultConfig } from './config/default-config';
export type { WidgetsConfig } from './config/types/widgets-config';
export { NoResults } from './shared/components/icons/NoResults';
export {
  PopoverRateInfo,
  POPOVER_TOOLTIP_TYPES,
  resolvePopoverTooltipKey,
  type PopoverTooltipType
} from './shared/components/ui/PopoverRateInfo';
export { PopoverInfo } from './shared/components/ui/PopoverInfo';
export type { PopoverInfoProps } from './shared/components/ui/PopoverInfo';
export { getTooltipById } from './data/tooltips';
export { UtilizationBar } from './shared/components/ui/UtilizationBar';
export type { UtilizationBarProps } from './shared/components/ui/UtilizationBar';
export { PairTokenIcons } from './shared/components/ui/token/PairTokenIcon';
export { useTokenImage } from './shared/hooks/useTokenImage';
export { useChainImage } from './shared/hooks/useChainImage';
export { WidgetContainer } from './shared/components/ui/widget/WidgetContainer';
export { CardAnimationWrapper } from './shared/animation/Wrappers';
export { positionAnimations } from './shared/animation/presets';
export type { WithWidgetProviderProps } from './shared/hocs/withWidgetProvider';
export { ConnectWalletCopy } from './shared/components/ui/ConnectWalletCopy';
export { ConnectWallet } from './shared/components/icons/ConnectWallet';
export {
  Clock,
  InProgress,
  SuccessCheck,
  SuccessCheckSolidColor,
  FailedX,
  Cancel
} from './shared/components/icons/Icons';
export { Morpho } from './shared/components/icons/Morpho';
export { Pendle } from './shared/components/icons/Pendle';
export { BalancesHistory } from './BalancesWidget/components/BalancesHistory';
