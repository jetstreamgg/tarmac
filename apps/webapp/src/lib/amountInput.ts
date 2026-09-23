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
 * What a paste contributes to an amount field, or `null` to refuse it. A paste
 * is the one edit where a comma-grouped figure realistically arrives, so an
 * en-US grouped number (`100,000`, `1,234.5`) loses its commas here rather
 * than reading its lone comma as the keypad decimal point (PR #1938 review).
 * Anything the mask would have to mangle to accept — an exponent, a sign, a
 * currency symbol — is refused whole: `1e5` silently becoming `15` is worse
 * than nothing happening. The EU keypad rule for a typed comma is unchanged.
 */
export function readPastedAmount(text: string): string | null {
  const trimmed = text.trim();
  if (!/^[0-9.,]*$/.test(trimmed)) return null;
  if (/^[1-9]\d{0,2}(,\d{3})+(\.\d*)?$/.test(trimmed)) return trimmed.replace(/,/g, '');
  return trimmed;
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

/**
 * Display text for the field: the masked digits with the integer part grouped
 * by thousands (Design QA 3314:135843 — `17,640.49`, not `1764049`). The
 * fraction and any trailing dot pass through untouched.
 */
export function groupAmountInput(text: string): string {
  const point = text.indexOf('.');
  const integer = point === -1 ? text : text.slice(0, point);
  const rest = point === -1 ? '' : text.slice(point);
  return `${integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}${rest}`;
}

/**
 * Strips the field's own group separators from what the user hands back so the
 * mask sees plain digits. An edit replaces one contiguous run of the text the
 * field showed, so everything outside that run (the unchanged prefix and
 * suffix) is the field's grouping and drops, whatever digit count now follows
 * it. Only a comma inside the edited run was typed, and the mask reads that one
 * as a decimal point (the EU keypad case, APP-518) — or, with several in a
 * paste, as grouping again.
 */
export function ungroupAmountInput(raw: string, shown: string): string {
  let prefix = 0;
  while (prefix < raw.length && prefix < shown.length && raw[prefix] === shown[prefix]) prefix += 1;
  let suffix = 0;
  while (
    suffix < raw.length - prefix &&
    suffix < shown.length - prefix &&
    raw[raw.length - 1 - suffix] === shown[shown.length - 1 - suffix]
  ) {
    suffix += 1;
  }
  const edited = raw.slice(prefix, raw.length - suffix);
  return `${raw.slice(0, prefix).replace(/,/g, '')}${edited}${raw.slice(raw.length - suffix).replace(/,/g, '')}`;
}

/**
 * Where the caret lands in the regrouped `text` after `count` non-separator
 * characters: the field regroups on every edit, which changes the length and
 * would otherwise drop the caret to the end. A caret that sat just after a
 * separator stays after the one now in that spot, including a typed decimal
 * comma the mask turned into the point.
 */
export function caretAfterCharacters(text: string, count: number, afterSeparator = false): number {
  let index = 0;
  let seen = 0;
  while (index < text.length && seen < count) {
    if (text[index] !== ',') seen += 1;
    index += 1;
  }
  return afterSeparator && (text[index] === ',' || text[index] === '.') ? index + 1 : index;
}
