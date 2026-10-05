import { useDebounce } from '@/hooks';

interface SettledAmount {
  /** The amount once typing has paused (500ms): the engine, the network reads and the amount displays read this. */
  debouncedAmount: bigint;
  /** The typed amount has not settled yet — a form's confirm gate holds until it has. */
  debouncePending: boolean;
}

/**
 * The settle every transaction form puts between its amount input and the
 * network: without it each keystroke refires the fee estimate, the engine's
 * simulation, the pre-send batch simulation and any quote. Validation keeps
 * reading the live amount for immediate feedback.
 *
 * Two changes skip the wait:
 * - a change of `unit` (token, decimals, direction, chain): the old number
 *   would otherwise be read in the new unit for half a second — 100 USDS
 *   drawn, previewed and quoted as 100·10¹² USDC;
 * - a cleared input: nothing network-bound runs on zero, and a lagging old
 *   amount would keep drawing a figure the user just erased.
 */
export function useSettledAmount(amount: bigint, unit?: string | number): SettledAmount {
  const debounced = useDebounce(amount, undefined, unit);
  const debouncedAmount = amount === 0n ? 0n : debounced;
  return { debouncedAmount, debouncePending: debouncedAmount !== amount };
}
