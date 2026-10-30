import { formatAddress } from '@/utils';

/**
 * A token symbol as a string, whatever arrived at runtime. Symbols from
 * third-party APIs are typed `string`, but nothing checks the payload, and a
 * non-string one throws wherever the UI calls a string method on it or renders
 * it (APP-654). Anything else becomes `''`, which the UI treats as "no symbol".
 * Normalize where API data enters; TokenIcon applies it again as a backstop.
 */
export function toTokenSymbol(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/**
 * A name to show for a token the user acts on: its symbol, or its shortened
 * address when the API sent no usable one, so a claim never reads "1.23 ".
 */
export function toTokenLabel(symbol: unknown, address: string): string {
  return toTokenSymbol(symbol) || formatAddress(address);
}
