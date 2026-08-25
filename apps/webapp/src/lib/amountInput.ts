import { parseUnits } from 'viem';

/**
 * Rewrite a locale decimal comma as the dot the mask below works in (APP-518).
 *
 * iOS puts a single decimal key on the numeric keypad and labels it from the
 * *system* locale, so on a phone set to most of Europe the only separator a
 * user can type is `,` — with the comma dropped, `1,5` became `15` and a
 * fraction was simply not enterable.
 *
 * When both marks are present the last one is the decimal separator and the
 * other is grouping, which reads "1,234.5" and "1.234,5" alike; more than one
 * comma can only be grouping. That leaves one genuinely ambiguous case, a lone
 * comma with a group-sized tail ("1,000"), and this resolves it as a decimal —
 * the keypad case is the one that happens, and because the field re-renders
 * with the masked text the reading is always visible before it can transact.
 */
export function normalizeDecimalSeparator(raw: string): string {
  const lastComma = raw.lastIndexOf(',');
  if (lastComma === -1) return raw;

  const isGrouping = raw.lastIndexOf('.') > lastComma || raw.indexOf(',') !== lastComma;
  if (isGrouping) return raw.replace(/,/g, '');

  return `${raw.slice(0, lastComma).replace(/\./g, '')}.${raw.slice(lastComma + 1)}`;
}

/**
 * Mask for the amount fields (APP-492): digits plus at most one decimal dot,
 * the fraction capped at `decimals` digits. A decimal comma is read as a dot
 * (see above); everything else — sign, exponent, group separators, whitespace
 * — is stripped, so an invalid amount is unrepresentable in a masked field and
 * the visible text always parses to exactly the transacted value.
 */
export function sanitizeAmountInput(raw: string, decimals: number): string {
  const [head, ...rest] = normalizeDecimalSeparator(raw)
    .replace(/[^0-9.]/g, '')
    .split('.');
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
