import { useMemo, useState, type ReactNode } from 'react';
import { useChainId, useConnection } from 'wagmi';
import { formatUnits, parseUnits } from 'viem';
import { t } from '@lingui/core/macro';
import {
  type Token,
  getTokenDecimals,
  useErc4626VaultData,
  useTokenBalance,
  type VaultProvider
} from '@/hooks';
import { formatNumber } from '@/utils';
import { VaultAmountSummary } from '../components/VaultAmountSummary';
import type { VaultEngineParams, VaultLaunchFlow } from './useVaultLaunch';

/** Seeds the form's initial amount (e.g. a Portfolio quick-deposit shortcut). */
export type VaultModalPreset = { amount?: string };

/** Minimized-toast titles, amount-aware (e.g. "10,000.00 USDC supplied!"). */
export type VaultToastTitles = { loading: string; success: string; error: string };

const parseAmount = (value: string, decimals: number): bigint => {
  try {
    return value ? parseUnits(value, decimals) : 0n;
  } catch {
    return 0n;
  }
};

export interface VaultTransactionForm {
  isConnected: boolean;
  isSupply: boolean;
  decimals: number;
  value: string;
  amount: bigint;
  /** Spendable balance for the flow: wallet balance (supply) / max withdraw (withdraw). */
  available: bigint;
  isZero: boolean;
  insufficient: boolean;
  amountReady: boolean;
  engineParams: VaultEngineParams;
  toast: VaultToastTitles;
  transactionScreenContent: ReactNode;
  onInput: (next: string) => void;
  setMaxAmount: () => void;
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

  const amount = parseAmount(value, decimals);

  const { data: walletBalance } = useTokenBalance({
    address,
    chainId,
    token: assetToken.address[chainId]
  });
  const { data: vaultData } = useErc4626VaultData({ vaultAddress, provider });

  const maxWithdraw = vaultData?.maxWithdraw ?? vaultData?.userAssets ?? 0n;
  const maxRedeem = vaultData?.maxRedeem ?? vaultData?.userShares ?? 0n;

  const available = isSupply ? (walletBalance?.value ?? 0n) : maxWithdraw;
  const isZero = amount === 0n;
  const insufficient = amount > available;
  const amountReady = isConnected && !isZero && !insufficient;

  const onInput = (next: string) => {
    setMax(false);
    setValue(next);
  };
  const setMaxAmount = () => {
    setValue(formatUnits(available, decimals));
    // On withdraw, Max redeems the whole share balance; supply just fills the amount.
    setMax(!isSupply);
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
    shares: maxRedeem
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
    () => <VaultAmountSummary assetToken={assetToken} amount={amount} decimals={decimals} />,
    [assetToken, amount, decimals]
  );

  return {
    isConnected,
    isSupply,
    decimals,
    value,
    amount,
    available,
    isZero,
    insufficient,
    amountReady,
    engineParams,
    toast,
    transactionScreenContent,
    onInput,
    setMaxAmount,
    clearAmount
  };
}
