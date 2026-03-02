import {
  useBatchMorphoVaultDeposit,
  useMorphoVaultWithdraw,
  useMorphoVaultRedeem,
  useMorphoVaultClaimRewards,
  MorphoVaultReward
} from '@jetstreamgg/sky-hooks';
import { WidgetContext } from '@widgets/context/WidgetContext';
import { useContext } from 'react';
import { MorphoVaultAction, MorphoVaultFlow } from '../lib/constants';
import { WidgetProps } from '@widgets/shared/types/widgetState';
import { useMorphoVaultTransactionCallbacks } from './useMorphoVaultTransactionCallbacks';

interface UseMorphoVaultTransactionsParameters
  extends Pick<WidgetProps, 'addRecentTransaction' | 'onWidgetStateChange' | 'onNotification' | 'onAnalyticsEvent'> {
  /** Amount of underlying assets to deposit/withdraw */
  amount: bigint;
  /** User's vault shares (used for redeem) */
  shares: bigint;
  /** Whether to use redeem instead of withdraw (for max withdrawals) */
  max: boolean;
  /** The Morpho vault address */
  vaultAddress: `0x${string}`;
  /** The underlying asset address (e.g., USDC) */
  assetAddress: `0x${string}`;
  /** Decimals of the underlying asset token */
  assetDecimals: number;
  /** Symbol of the underlying asset token */
  assetSymbol: string;
  /** Display name for the vault */
  vaultName: string;
  /** Whether the supply flow requires a token approval step */
  needsAllowance: boolean;
  /** Whether to use batch transactions */
  shouldUseBatch: boolean;
  /** Rewards data for claiming */
  rewards?: MorphoVaultReward[];
  /** Whether rewards can be claimed */
  hasClaimableRewards?: boolean;
  /** Callback to refresh allowance data */
  mutateAllowance: () => void;
  /** Callback to refresh vault data */
  mutateVaultData: () => void;
  /** Callback to refresh asset balance */
  mutateAssetBalance: () => void;
  /** Callback to refresh rewards data */
  mutateRewards?: () => void;
}

export const useMorphoVaultTransactions = ({
  amount,
  shares,
  max,
  vaultAddress,
  assetAddress,
  assetDecimals,
  assetSymbol,
  vaultName,
  needsAllowance,
  shouldUseBatch,
  rewards,
  hasClaimableRewards,
  mutateAllowance,
  mutateVaultData,
  mutateAssetBalance,
  mutateRewards,
  addRecentTransaction,
  onWidgetStateChange,
  onNotification,
  onAnalyticsEvent
}: UseMorphoVaultTransactionsParameters) => {
  const { widgetState } = useContext(WidgetContext);

  const { supplyTransactionCallbacks, withdrawTransactionCallbacks, claimRewardsTransactionCallbacks } =
    useMorphoVaultTransactionCallbacks({
      amount,
      assetDecimals,
      assetSymbol,
      vaultAddress,
      assetAddress,
      vaultName,
      rewards,
      needsAllowance,
      shouldUseBatch,
      mutateAllowance,
      mutateVaultData,
      mutateAssetBalance,
      mutateRewards,
      addRecentTransaction,
      onWidgetStateChange,
      onNotification,
      onAnalyticsEvent
    });

  // Deposit hook (with batch approval support)
  const morphoVaultDeposit = useBatchMorphoVaultDeposit({
    amount,
    vaultAddress,
    assetAddress,
    shouldUseBatch,
    enabled:
      widgetState.flow === MorphoVaultFlow.SUPPLY &&
      (widgetState.action === MorphoVaultAction.SUPPLY || widgetState.action === MorphoVaultAction.APPROVE),
    ...supplyTransactionCallbacks
  });

  // Withdraw hook (for partial withdrawals)
  const morphoVaultWithdraw = useMorphoVaultWithdraw({
    amount,
    vaultAddress,
    enabled: widgetState.action === MorphoVaultAction.WITHDRAW && !max,
    ...withdrawTransactionCallbacks
  });

  // Redeem hook (for max withdrawals to avoid dust)
  const morphoVaultRedeem = useMorphoVaultRedeem({
    shares,
    vaultAddress,
    enabled: widgetState.action === MorphoVaultAction.WITHDRAW && max,
    ...withdrawTransactionCallbacks
  });

  // Claim rewards hook
  const morphoVaultClaimRewards = useMorphoVaultClaimRewards({
    rewards: rewards ?? [],
    enabled: hasClaimableRewards ?? false,
    ...claimRewardsTransactionCallbacks
  });

  return { morphoVaultDeposit, morphoVaultWithdraw, morphoVaultRedeem, morphoVaultClaimRewards };
};
