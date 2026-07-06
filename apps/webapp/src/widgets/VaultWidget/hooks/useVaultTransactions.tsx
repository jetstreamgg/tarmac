import { useBatchVaultDeposit, useVaultWithdraw, useVaultRedeem } from '@/hooks';
import { WidgetContext } from '@/widgets/context/WidgetContext';
import { useContext } from 'react';
import { VaultAction, VaultFlow } from '../lib/constants';
import {
  WidgetProps,
  OnNotificationCallback,
  OnAnalyticsEventCallback
} from '@/widgets/shared/types/widgetState';
import { VaultProvider } from '@/hooks/vaults/types';
import { useVaultTransactionCallbacks } from './useVaultTransactionCallbacks';

interface UseVaultTransactionsParameters extends Pick<WidgetProps, 'onWidgetStateChange'> {
  onNotification?: OnNotificationCallback;
  onAnalyticsEvent?: OnAnalyticsEventCallback;
  /** Amount of underlying assets to deposit/withdraw */
  amount: bigint;
  /** User's vault shares (used for redeem) */
  shares: bigint;
  /** Whether to use redeem instead of withdraw (for max withdrawals) */
  max: boolean;
  /** Which provider operates the vault — only Spark attaches the on-chain referral code */
  provider: VaultProvider;
  /** Referral code to attribute Spark deposits to (ignored for Morpho) */
  referralCode: number;
  /** The vault address */
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
  /** Callback to refresh allowance data */
  mutateAllowance: () => void;
  /** Callback to refresh vault data */
  mutateVaultData: () => void;
  /** Callback to refresh asset balance */
  mutateAssetBalance: () => void;
}

export const useVaultTransactions = ({
  amount,
  shares,
  max,
  provider,
  referralCode,
  vaultAddress,
  assetAddress,
  assetDecimals,
  assetSymbol,
  vaultName,
  needsAllowance,
  shouldUseBatch,
  mutateAllowance,
  mutateVaultData,
  mutateAssetBalance,
  onWidgetStateChange,
  onNotification,
  onAnalyticsEvent
}: UseVaultTransactionsParameters) => {
  const { widgetState } = useContext(WidgetContext);

  const { supplyTransactionCallbacks, withdrawTransactionCallbacks } = useVaultTransactionCallbacks({
    amount,
    assetDecimals,
    assetSymbol,
    vaultAddress,
    assetAddress,
    vaultName,
    needsAllowance,
    shouldUseBatch,
    mutateAllowance,
    mutateVaultData,
    mutateAssetBalance,
    onWidgetStateChange,
    onNotification,
    onAnalyticsEvent
  });

  // Deposit hook (with batch approval support)
  const morphoVaultDeposit = useBatchVaultDeposit({
    amount,
    vaultAddress,
    assetAddress,
    provider,
    referral: referralCode,
    shouldUseBatch,
    enabled:
      widgetState.flow === VaultFlow.SUPPLY &&
      (widgetState.action === VaultAction.SUPPLY || widgetState.action === VaultAction.APPROVE),
    ...supplyTransactionCallbacks
  });

  // Withdraw hook (for partial withdrawals)
  const morphoVaultWithdraw = useVaultWithdraw({
    amount,
    vaultAddress,
    enabled: widgetState.action === VaultAction.WITHDRAW && !max,
    ...withdrawTransactionCallbacks
  });

  // Redeem hook (for max withdrawals to avoid dust)
  const morphoVaultRedeem = useVaultRedeem({
    shares,
    vaultAddress,
    enabled: widgetState.action === VaultAction.WITHDRAW && max,
    ...withdrawTransactionCallbacks
  });

  return { morphoVaultDeposit, morphoVaultWithdraw, morphoVaultRedeem };
};
