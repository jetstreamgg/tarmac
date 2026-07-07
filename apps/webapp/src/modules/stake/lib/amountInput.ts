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
 * slider): trailing zeros trimmed, zero renders as empty (placeholder shows).
 */
export function formatAmountForInput(amount: bigint): string {
  if (amount === 0n) return '';
  const text = formatUnits(amount, 18);
  return text.includes('.') ? text.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '') : text;
}
