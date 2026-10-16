import { formatUnits } from 'viem';

/**
 * Exact input text for a programmatic amount (percent chips, slider): plain
 * digits like every other amount field, trailing zeros trimmed, zero renders
 * as empty (placeholder shows). Round-trips through `parseAmountInput` —
 * UNLESS `maxDecimals` truncates (display-only cap for exact-max staging like
 * the repay 100% chip, where the staged wei-precise debt must not overflow the
 * field; the state keeps the exact value). `round` rounds that cap half-up.
 */
export function formatAmountForInput(amount: bigint, maxDecimals?: number, round = false): string {
  if (amount === 0n) return '';
  // Half-up rounding matches formatBigInt, so a rounded cap reads like the summary rows.
  const shown = round && maxDecimals !== undefined ? amount + 5n * 10n ** BigInt(17 - maxDecimals) : amount;
  const [integer, decimals] = formatUnits(shown, 18).split('.');
  const capped = maxDecimals !== undefined ? decimals?.slice(0, maxDecimals) : decimals;
  const trimmedDecimals = capped?.replace(/0+$/, '');
  return trimmedDecimals ? `${integer}.${trimmedDecimals}` : integer;
}
