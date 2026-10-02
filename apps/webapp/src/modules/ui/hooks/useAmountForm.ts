import { useCallback, useMemo, useState } from 'react';
import { useConnection } from 'wagmi';
import { formatUnits } from 'viem';
import { t } from '@lingui/core/macro';
import { formatNumber } from '@/utils';
import { parseAmountInput } from '@/lib/amountInput';

/** Minimized-toast titles, amount-aware (e.g. "10,000.00 USDS supplied!"). */
export type AmountToastTitles = { loading: string; success: string; error: string };

/** Seeds the form's initial amount (e.g. a Portfolio quick-deposit shortcut). */
type AmountPreset = { amount?: string };

interface UseAmountFormParams {
  /** Decimals of the token the amount is entered in. */
  decimals: number;
  /** Spendable balance for the flow (wallet balance on supply; position / max withdraw otherwise). */
  available: bigint;
  /** The `available` read has resolved — validation waits on it (never gate on the 0n fallback). */
  availableKnown: boolean;
  /** Symbol drawn in the toast titles. */
  symbol: string;
  isSupply: boolean;
  /** Read once on mount. */
  preset?: AmountPreset;
  /**
   * Whether a Max click also raises the `max` flag — the withdraw flows whose
   * engine redeems the whole position (no dust) off the flag rather than the
   * displayed (rounded) number. Off (the default), Max just fills the amount.
   */
  maxRedeems?: boolean;
  /**
   * Clamps the entered amount to the context it was entered in: a change of
   * key reads as an empty form (value '' / max false) without resetting the
   * state, so a there-and-back change restores the entry. The savings modal
   * keys on the chain — an amount is only meaningful on the chain it was sized
   * against, and a Max carried across a switch would redeem the OTHER chain's
   * position.
   */
  entryKey?: unknown;
}

interface AmountForm {
  /** The raw input text (empty when clamped off by `entryKey`). */
  value: string;
  /** The parsed amount at `decimals` (0n for empty / unparseable text). */
  amount: bigint;
  /** Max was clicked with `maxRedeems` on; cleared the moment the amount is edited. */
  max: boolean;
  isZero: boolean;
  insufficient: boolean;
  /** True when the amount/connection gate is satisfied; combine with the engine's `prepared` for the submit gate. */
  amountReady: boolean;
  /** Amount-aware minimized-toast titles for the active flow. */
  toast: AmountToastTitles;
  /** Typing overrides a previous Max selection. */
  onInput: (raw: string) => void;
  setMaxAmount: () => void;
  /** Set the amount to a percentage of the available balance; 100 routes through Max (no-dust withdraw). */
  setPercentAmount: (pct: number) => void;
  /** Clear the amount + Max — for a post-success reset. */
  clearAmount: () => void;
}

/**
 * The amount-input core every product transaction form repeats: the entered
 * text seeded from `preset`, the withdraw-Max flag, the parsed bigint, the
 * plain spend gate (`isZero` / `insufficient` / `amountReady`), the Max and
 * 25/50/100% chip handlers, and the minimized-toast titles. Forms that carry
 * extra gate inputs (the savings USDC/PSM gate, the stUSDS provider routing)
 * derive their own `insufficient` / `amountReady` over this hook's state.
 */
export function useAmountForm({
  decimals,
  available,
  availableKnown,
  symbol,
  isSupply,
  preset,
  maxRedeems = false,
  entryKey
}: UseAmountFormParams): AmountForm {
  const { isConnected } = useConnection();

  const [entered, setEntered] = useState<{ key: unknown; value: string; max: boolean }>({
    key: entryKey,
    value: preset?.amount ?? '',
    max: false
  });
  const live = entered.key === entryKey;
  const value = live ? entered.value : '';
  const max = live && entered.max;
  const setAmount = useCallback(
    (nextValue: string, nextMax = false) => setEntered({ key: entryKey, value: nextValue, max: nextMax }),
    [entryKey]
  );

  const amount = parseAmountInput(value, decimals);
  const isZero = amount === 0n;
  const insufficient = availableKnown && amount > available;
  const amountReady = isConnected && !isZero && availableKnown && !insufficient;

  const onInput = useCallback((raw: string) => setAmount(raw), [setAmount]);

  const setMaxAmount = useCallback(
    () => setAmount(formatUnits(available, decimals), maxRedeems),
    [available, decimals, maxRedeems, setAmount]
  );

  // The 25/50/100% chips. 100% is the old Max — same no-dust semantics where
  // the flow redeems off the flag; the partial presets are plain amounts.
  const setPercentAmount = useCallback(
    (pct: number) => {
      if (pct >= 100) {
        setMaxAmount();
        return;
      }
      setAmount(formatUnits((available * BigInt(pct)) / 100n, decimals));
    },
    [setMaxAmount, available, decimals, setAmount]
  );

  const clearAmount = useCallback(() => setAmount(''), [setAmount]);

  const amountLabel = `${formatNumber(parseFloat(formatUnits(amount, decimals)), { maxDecimals: 2 })} ${symbol}`;
  const toast = useAmountToast({ isSupply, amountLabel });

  return {
    value,
    amount,
    max,
    isZero,
    insufficient,
    amountReady,
    toast,
    onInput,
    setMaxAmount,
    setPercentAmount,
    clearAmount
  };
}

/**
 * Amount-aware titles for the minimized toast (Figma "10,000.00 USDS
 * supplied!"). Memoized so the modal-content sync effects in the modal forms
 * have stable deps — an unmemoized object here recreates every render and
 * loops updateModalContent → setActiveConfig → re-render.
 */
export function useAmountToast({
  isSupply,
  amountLabel
}: {
  isSupply: boolean;
  /** Formatted amount + symbol (e.g. "10,000.00 USDS"). */
  amountLabel: string;
}): AmountToastTitles {
  return useMemo<AmountToastTitles>(
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
}
