import { formatUnits } from 'viem';

/**
 * Exact input text for a programmatic amount (percent chips, slider): plain
 * digits like every other amount field, trailing zeros trimmed, zero renders
 * as empty (placeholder shows). Round-trips through `parseAmountInput` —
 * UNLESS `maxDecimals` truncates (display-only cap for exact-max staging like
 * the repay 100% chip, where the staged wei-precise debt must not overflow the
 * field; the state keeps the exact value).
 */
export function formatAmountForInput(amount: bigint, maxDecimals?: number): string {
  if (amount === 0n) return '';
  const [integer, decimals] = formatUnits(amount, 18).split('.');
  const capped = maxDecimals !== undefined ? decimals?.slice(0, maxDecimals) : decimals;
  const trimmedDecimals = capped?.replace(/0+$/, '');
  return trimmedDecimals ? `${integer}.${trimmedDecimals}` : integer;
}
