import { parseUnits } from 'viem';

/**
 * Rewrite a locale decimal comma as the dot the mask below works in (APP-518).
 *
 * iOS puts a single decimal key on the numeric keypad and labels it from the
 * *system* locale, so on a phone set to most of Europe the only separator a
 * user can type is `,` — with the comma dropped, `1,5` became `15` and a
 * fraction was simply not enterable.
 *
 * Only a comma standing alone reads as that point. A dot already in the text
 * is the decimal point — the fields are controlled and re-render masked, so
 * the only dot they can hold is one the mask put there — which makes any comma
 * beside it a group mark or a stray keypad tap; either way it drops. More than
 * one comma is grouping for the same reason.
 *
 * That costs the EU-formatted paste "1.234,5", read as 1.2345 rather than
 * 1234.5. It is the same string a keypad user produces by typing 1 , 2 3 4 ,
 * (the field shows "1.234" after the first comma), and there the second comma
 * is a slip that must not move the point a user is watching — mis-reading a
 * paste beats silently multiplying a typed amount by 1000. Reading the lone
 * comma in "1,000" as a decimal is the mirror of the same call.
 */
export function normalizeDecimalSeparator(raw: string): string {
  const lastComma = raw.lastIndexOf(',');
  if (lastComma === -1) return raw;

  const isGrouping = raw.includes('.') || raw.indexOf(',') !== lastComma;
  if (isGrouping) return raw.replace(/,/g, '');

  return `${raw.slice(0, lastComma)}.${raw.slice(lastComma + 1)}`;
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
