import { parseUnits } from 'viem';

/**
 * Mask for the amount fields (APP-492): digits plus at most one decimal dot,
 * the fraction capped at `decimals` digits. Everything else — sign, exponent,
 * group separators, whitespace — is stripped, so an invalid amount is
 * unrepresentable in a masked field and the visible text always parses to
 * exactly the transacted value.
 */
export function sanitizeAmountInput(raw: string, decimals: number): string {
  const [head, ...rest] = raw.replace(/[^0-9.]/g, '').split('.');
  if (rest.length === 0 || decimals <= 0) return head;
  return `${head}.${rest.join('').slice(0, decimals)}`;
}

/**
 * Parse a masked field's text to a bigint at `decimals`. Strict: a string the
 * mask could not have produced (sign, exponent, second dot, excess decimals)
 * parses to 0n rather than a nearby value, so text that reached state without
 * passing the mask can never transact an amount the field wouldn't show.
 * In-progress states ('', '.', a trailing dot) parse to their obvious value.
 * Never throws.
 */
export function parseAmountInput(value: string, decimals: number): bigint {
  if (!value || value === '.' || value !== sanitizeAmountInput(value, decimals)) return 0n;
  return parseUnits(value, decimals);
}
