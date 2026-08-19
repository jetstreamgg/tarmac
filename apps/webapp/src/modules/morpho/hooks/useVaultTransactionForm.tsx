import { useMemo, useState, type ReactNode } from 'react';
import { useChainId, useConnection } from 'wagmi';
import { formatUnits } from 'viem';
import { t } from '@lingui/core/macro';
import {
  type Token,
  computeVaultLimits,
  getTokenDecimals,
  useErc4626VaultData,
  useTokenBalance,
  useVaultMarketData,
  type VaultProvider
} from '@/hooks';
import { formatNumber } from '@/utils';
import { parseAmountInput } from '@/lib/amountInput';
import { VaultAmountSummary } from '../components/VaultAmountSummary';
import type { VaultEngineParams, VaultLaunchFlow } from './useVaultLaunch';

/** Seeds the form's initial amount (e.g. a Portfolio quick-deposit shortcut). */
export type VaultModalPreset = { amount?: string };

/** Minimized-toast titles, amount-aware (e.g. "10,000.00 USDC supplied!"). */
export type VaultToastTitles = { loading: string; success: string; error: string };

export interface VaultTransactionForm {
  isConnected: boolean;
  isSupply: boolean;
  decimals: number;
  value: string;
  amount: bigint;
  /** Spendable balance for the flow: wallet balance (supply) / max withdraw (withdraw). */
  available: bigint;
  /** The `available` read has resolved — display and validation wait on it. */
  availableKnown: boolean;
  isZero: boolean;
  insufficient: boolean;
  amountReady: boolean;
  /** Supplied position in asset units (ERC-4626 `userAssets`) — feeds the entry deltas. */
  position: bigint;
  /** Withdraw-relevant: vault liquidity currently caps the input below the position. */
  isLiquidityConstrained: boolean;
  /** Withdraw-relevant: the provider's liquidity source settled without a figure. */
  isLiquidityDataUnavailable: boolean;
  engineParams: VaultEngineParams;
  toast: VaultToastTitles;
  transactionScreenContent: ReactNode;
  onInput: (next: string) => void;
  setMaxAmount: () => void;
  /** Set the amount to a percentage of the available balance; 100 routes through Max (no-dust withdraw). */
  setPercentAmount: (pct: number) => void;
  clearAmount: () => void;
}

/**
 * Shared form model for the vault supply/withdraw modal — the vault analogue of
 * `useSavingsTransactionForm`. Owns the amount/Max state, reads the wallet
 * balance + ERC-4626 position, derives the spend gate, and maps it all to the
 * `useVaultLaunch` engine params. There is no origin-token choice: a vault
 * supplies/withdraws its single underlying asset.
 */
export function useVaultTransactionForm({
  flow,
  vaultAddress,
  assetToken,
  provider = 'morpho',
  preset
}: {
  flow: VaultLaunchFlow;
  vaultAddress: `0x${string}`;
  assetToken: Token;
  provider?: VaultProvider;
  preset?: VaultModalPreset;
}): VaultTransactionForm {
  const chainId = useChainId();
  const { address, isConnected } = useConnection();
  const isSupply = flow === 'supply';
  const decimals = getTokenDecimals(assetToken, chainId);

  const [value, setValue] = useState(preset?.amount ?? '');
  // Withdraw-only: set by Max so the engine redeems the whole position (no dust).
  const [max, setMax] = useState(false);

  const amount = parseAmountInput(value, decimals);

  const { data: walletBalance } = useTokenBalance({
    address,
    chainId,
    token: assetToken.address[chainId]
  });
  const { data: vaultData } = useErc4626VaultData({ vaultAddress, provider });
  // Morpho publishes the vault's withdrawable liquidity through its market API;
  // its on-chain `maxWithdraw`/`maxRedeem` are stubs that read 0 for everyone
  // (APP-456 #7). `computeVaultLimits` owns that provider split, shared with the
  // widget's supply/withdraw pane so both surfaces agree per vault.
  const { data: marketData, isLoading: isMarketDataLoading } = useVaultMarketData({
    provider,
    vaultAddress
  });

  const {
    maxDepositInput,
    maxWithdrawInput,
    redeemShares,
    isLiquidityConstrained,
    isFullPositionWithdrawable,
    isLiquidityDataUnavailable
  } = computeVaultLimits({
    provider,
    assetBalance: walletBalance?.value,
    maxDeposit: vaultData?.maxDeposit,
    userAssets: vaultData?.userAssets,
    userShares: vaultData?.userShares,
    maxWithdraw: vaultData?.maxWithdraw,
    maxRedeem: vaultData?.maxRedeem,
    availableLiquidity: marketData?.liquidity,
    liquidityKnown: !isMarketDataLoading
  });

  const position = vaultData?.userAssets ?? 0n;
  // While the liquidity read is in flight the position backs the input (no
  // "Balance: 0" flash); if liquidity settles lower the insufficient gate re-clamps.
  const available = isSupply ? maxDepositInput : (maxWithdrawInput ?? position);
  // Never validate against the unresolved balance/position read's 0n fallback.
  const availableKnown = isSupply ? walletBalance !== undefined : vaultData !== undefined;
  const isZero = amount === 0n;
  const insufficient = availableKnown && amount > available;
  const amountReady = isConnected && amount > 0n && availableKnown && !insufficient;

  const onInput = (next: string) => {
    setMax(false);
    setValue(next);
  };
  const setMaxAmount = () => {
    setValue(formatUnits(available, decimals));
    // Max redeems the whole share balance (no dust) only when the full position
    // is withdrawable; under a liquidity constraint the engine runs a plain
    // withdraw of the cap instead — a redeem-all would revert (APP-488).
    setMax(!isSupply && isFullPositionWithdrawable);
  };
  const setPercentAmount = (pct: number) => {
    if (pct >= 100) return setMaxAmount();
    setMax(false);
    setValue(formatUnits((available * BigInt(pct)) / 100n, decimals));
  };
  const clearAmount = () => {
    setValue('');
    setMax(false);
  };

  const engineParams: VaultEngineParams = {
    flow,
    vaultAddress,
    assetToken,
    provider,
    amount,
    max,
    shares: redeemShares
  };

  const amountLabel = `${formatNumber(parseFloat(formatUnits(amount, decimals)), { maxDecimals: 2 })} ${assetToken.symbol}`;
  // Memoized so the modal-content sync effect in VaultModalForm has stable deps —
  // an unmemoized object/element here recreates every render and loops
  // updateModalContent → setActiveConfig → re-render (matches the savings form).
  const toast = useMemo<VaultToastTitles>(
    () =>
      isSupply
        ? {
            loading: t`Supplying ${amountLabel}`,
            success: t`${amountLabel} supplied!`,
            error: t`Supply failed`
          }
        : {
            loading: t`Withdrawing ${amountLabel}`,
            success: t`${amountLabel} withdrawn!`,
            error: t`Withdrawal failed`
          },
    [isSupply, amountLabel]
  );

  const transactionScreenContent = useMemo(
    () => (
      <VaultAmountSummary
        label={isSupply ? t`Supply amount` : t`Withdrawal amount`}
        assetToken={assetToken}
        amount={amount}
        decimals={decimals}
      />
    ),
    [isSupply, assetToken, amount, decimals]
  );

  return {
    isConnected,
    isSupply,
    decimals,
    value,
    amount,
    available,
    availableKnown,
    isZero,
    insufficient,
    amountReady,
    position,
    isLiquidityConstrained,
    isLiquidityDataUnavailable,
    engineParams,
    toast,
    transactionScreenContent,
    onInput,
    setMaxAmount,
    setPercentAmount,
    clearAmount
  };
}
