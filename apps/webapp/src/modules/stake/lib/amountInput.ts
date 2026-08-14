import { formatUnits } from 'viem';

/**
 * Exact input text for a programmatic amount (percent chips, slider):
 * thousands grouped per the hi-fi, trailing zeros trimmed, zero renders as
 * empty (placeholder shows). Value-preserving through the field's shared
 * amount mask (`@/lib/amountInput`), which drops the grouping commas before
 * parsing — UNLESS `maxDecimals` truncates (display-only cap for exact-max
 * staging like the repay 100% chip, where the staged wei-precise debt must not
 * overflow the field; the state keeps the exact value).
 */
export function formatAmountForInput(amount: bigint, maxDecimals?: number): string {
  if (amount === 0n) return '';
  const text = formatUnits(amount, 18);
  const [integer, decimals] = text.split('.');
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const capped = maxDecimals !== undefined ? decimals?.slice(0, maxDecimals) : decimals;
  const trimmedDecimals = capped?.replace(/0+$/, '');
  return trimmedDecimals ? `${grouped}.${trimmedDecimals}` : grouped;
}
