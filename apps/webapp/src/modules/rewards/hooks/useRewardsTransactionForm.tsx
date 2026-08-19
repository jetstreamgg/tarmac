import { useMemo, useState, type ReactNode } from 'react';
import { useChainId, useConnection } from 'wagmi';
import { formatUnits } from 'viem';
import { t } from '@lingui/core/macro';
import { type Token, getTokenDecimals, useRewardsSuppliedBalance, useTokenBalance } from '@/hooks';
import { formatNumber } from '@/utils';
import { parseAmountInput } from '@/lib/amountInput';
import { RewardsAmountSummary } from '../components/RewardsAmountSummary';
import type { RewardsEngineParams, RewardsLaunchFlow } from './useRewardsLaunch';

/** Seeds the form's initial amount (e.g. a Portfolio quick-supply shortcut). */
export type RewardsModalPreset = { amount?: string };

/** Minimized-toast titles, amount-aware (e.g. "10,000.00 USDS supplied!"). */
export type RewardsToastTitles = { loading: string; success: string; error: string };

export interface RewardsTransactionForm {
  isConnected: boolean;
  isSupply: boolean;
  decimals: number;
  value: string;
  amount: bigint;
  /** Spendable balance for the flow: wallet balance (supply) / staked balance (withdraw). */
  available: bigint;
  /** Current staked position in the farm (both flows) — feeds the Supply delta cells. */
  position: bigint;
  isZero: boolean;
  insufficient: boolean;
  amountReady: boolean;
  engineParams: RewardsEngineParams;
  toast: RewardsToastTitles;
  transactionScreenContent: ReactNode;
  onInput: (next: string) => void;
  setMaxAmount: () => void;
  setPercentAmount: (pct: number) => void;
  clearAmount: () => void;
}

/**
 * Shared form model for the rewards supply/withdraw modal — the rewards analogue
 * of `useVaultTransactionForm`. Owns the amount/Max state, reads the wallet
 * balance + staked position, derives the spend gate, and maps it all to the
 * `useRewardsLaunch` engine params. There is no origin-token choice: a reward
 * contract stakes/withdraws its single supply token, and `withdraw(amount)` is
 * exact so Max simply fills the full staked balance (no redeem analogue).
 */
export function useRewardsTransactionForm({
  flow,
  contractAddress,
  supplyToken,
  preset
}: {
  flow: RewardsLaunchFlow;
  contractAddress: `0x${string}`;
  supplyToken: Token;
  preset?: RewardsModalPreset;
}): RewardsTransactionForm {
  const chainId = useChainId();
  const { address, isConnected } = useConnection();
  const isSupply = flow === 'supply';
  const decimals = getTokenDecimals(supplyToken, chainId);

  const [value, setValue] = useState(preset?.amount ?? '');

  const amount = parseAmountInput(value, decimals);

  const { data: walletBalance } = useTokenBalance({
    address,
    chainId,
    token: supplyToken.address[chainId]
  });
  const { data: suppliedBalance } = useRewardsSuppliedBalance({ contractAddress, address, chainId });

  const position = suppliedBalance ?? 0n;
  const available = isSupply ? (walletBalance?.value ?? 0n) : position;
  const isZero = amount === 0n;
  const insufficient = amount > available;
  const amountReady = isConnected && !isZero && !insufficient;

  const onInput = setValue;
  const setMaxAmount = () => setValue(formatUnits(available, decimals));
  // The 25/50/100% chips — 100% is the old Max (`withdraw(amount)` is exact, so
  // the full balance carries no dust risk); the partial presets are plain amounts.
  const setPercentAmount = (pct: number) =>
    setValue(formatUnits(pct >= 100 ? available : (available * BigInt(pct)) / 100n, decimals));
  const clearAmount = () => setValue('');

  const engineParams: RewardsEngineParams = { flow, contractAddress, supplyToken, amount };

  const amountLabel = `${formatNumber(parseFloat(formatUnits(amount, decimals)), { maxDecimals: 2 })} ${supplyToken.symbol}`;
  // Memoized so the modal-content sync effect in RewardsModalForm has stable deps —
  // an unmemoized object/element here recreates every render and loops
  // updateModalContent → setActiveConfig → re-render (matches the savings/vault forms).
  const toast = useMemo<RewardsToastTitles>(
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
      <RewardsAmountSummary
        label={isSupply ? t`Supply amount` : t`Withdrawal amount`}
        supplyToken={supplyToken}
        amount={amount}
        decimals={decimals}
      />
    ),
    [isSupply, supplyToken, amount, decimals]
  );

  return {
    isConnected,
    isSupply,
    decimals,
    value,
    amount,
    available,
    position,
    isZero,
    insufficient,
    amountReady,
    engineParams,
    toast,
    transactionScreenContent,
    onInput,
    setMaxAmount,
    setPercentAmount,
    clearAmount
  };
}
