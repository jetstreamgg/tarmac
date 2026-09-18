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
 * Strips the group separators from what the user hands back so the mask sees
 * plain digits. A comma with three or more digits after it is grouping (the
 * field's own, possibly with a digit just typed after it); a shorter one stays
 * for the mask to read as a decimal point (the EU keypad case, APP-518) — the
 * mask turns that comma into a dot on the same keystroke, so it never grows a
 * three-digit fraction behind it.
 */
export function ungroupAmountInput(raw: string): string {
  return raw.replace(/,(?=\d{3})/g, '');
}
