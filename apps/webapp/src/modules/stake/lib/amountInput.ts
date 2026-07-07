import { formatUnits, parseUnits } from 'viem';

/** Keep digits, comma group separators, and at most one decimal dot. */
export function sanitizeAmountText(text: string): string {
  const stripped = text.replace(/[^0-9.,]/g, '');
  const [head, ...rest] = stripped.split('.');
  return rest.length > 0 ? `${head}.${rest.join('').replace(/,/g, '')}` : head;
}

/** Parse a (possibly comma-grouped) decimal string to an 18-decimal bigint. */
export function parseAmountText(text: string): bigint {
  const clean = sanitizeAmountText(text).replace(/,/g, '');
  if (!clean || clean === '.') return 0n;
  try {
    return parseUnits(clean, 18);
  } catch {
    return 0n;
  }
}

/**
 * Exact, re-parseable input text for a programmatic amount (percent chips,
 * slider): thousands grouped per the hi-fi, trailing zeros trimmed, zero
 * renders as empty (placeholder shows). Round-trips through parseAmountText —
 * UNLESS `maxDecimals` truncates (display-only cap for exact-max staging like
 * the repay 100% chip, where the staged wei-precise debt must not overflow the
 * field; the state keeps the exact value).
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
