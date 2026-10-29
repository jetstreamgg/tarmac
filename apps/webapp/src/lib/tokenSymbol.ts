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
