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
