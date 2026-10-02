import { useMemo, type ReactNode } from 'react';
import { useChainId, useConnection } from 'wagmi';
import { t } from '@lingui/core/macro';
import { type Token, getTokenDecimals, useRewardsSuppliedBalance, useTokenBalance } from '@/hooks';
import { useAmountForm, type AmountToastTitles } from '@/modules/ui/hooks/useAmountForm';
import { RewardsAmountSummary } from '../components/RewardsAmountSummary';
import type { RewardsEngineParams, RewardsLaunchFlow } from './useRewardsLaunch';

/** Seeds the form's initial amount (e.g. a Portfolio quick-supply shortcut). */
export type RewardsModalPreset = { amount?: string };

/** Minimized-toast titles, amount-aware (e.g. "10,000.00 USDS supplied!"). */
export type RewardsToastTitles = AmountToastTitles;

export interface RewardsTransactionForm {
  isConnected: boolean;
  isSupply: boolean;
  decimals: number;
  value: string;
  amount: bigint;
  /** Spendable balance for the flow: wallet balance (supply) / staked balance (withdraw). */
  available: bigint;
  /** The `available` read has resolved — display and validation wait on it. */
  availableKnown: boolean;
  /** Current staked position in the farm (both flows) — feeds the Supply delta cells. */
  position: bigint;
  /** The `position` read has resolved — the Supply/earnings cells hold a skeleton until it has. */
  positionKnown: boolean;
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

  const { data: walletBalance } = useTokenBalance({
    address,
    chainId,
    token: supplyToken.address[chainId]
  });
  const { data: suppliedBalance } = useRewardsSuppliedBalance({ contractAddress, address, chainId });

  const position = suppliedBalance ?? 0n;
  const available = isSupply ? (walletBalance?.value ?? 0n) : position;
  // Never validate against the unresolved balance's 0n fallback.
  const availableKnown = isSupply ? walletBalance !== undefined : suppliedBalance !== undefined;
  const positionKnown = suppliedBalance !== undefined;

  // No Max flag: `withdraw(amount)` is exact, so the full balance carries no
  // dust risk and Max / the 100% chip simply fill the staked balance.
  const {
    value,
    amount,
    isZero,
    insufficient,
    amountReady,
    toast,
    onInput,
    setMaxAmount,
    setPercentAmount,
    clearAmount
  } = useAmountForm({
    decimals,
    available,
    availableKnown,
    symbol: supplyToken.symbol,
    isSupply,
    preset
  });

  const engineParams: RewardsEngineParams = { flow, contractAddress, supplyToken, amount };

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
    availableKnown,
    position,
    positionKnown,
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
