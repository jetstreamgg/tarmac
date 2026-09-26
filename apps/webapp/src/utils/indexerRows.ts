/**
 * Guards for rows that arrive from the indexer as untyped JSON.
 *
 * `BigInt(undefined)` and `BigInt('1.5')` both throw, and a throw inside a
 * page mapper takes the whole history view down with it. These helpers let a
 * mapper drop the one malformed row instead.
 */

/** `BigInt(value)` that returns `undefined` instead of throwing on bad input. */
export function safeBigInt(value: unknown): bigint | undefined {
  if (typeof value === 'bigint') return value;
  if (typeof value !== 'string' && typeof value !== 'number') return undefined;
  // `BigInt('')` is 0n, not an error; a blank amount is still a malformed row.
  if (typeof value === 'string' && value.trim() === '') return undefined;
  try {
    return BigInt(value);
  } catch {
    return undefined;
  }
}

/**
 * Maps an indexer row list, tolerating a missing list and skipping rows the
 * mapper rejects (returns `undefined` for).
 */
export function mapIndexerRows<Row, Out>(rows: unknown, map: (row: Row) => Out | undefined): Out[] {
  if (!Array.isArray(rows)) return [];
  const out: Out[] = [];
  for (const row of rows) {
    const mapped = map(row as Row);
    if (mapped !== undefined) out.push(mapped);
  }
  return out;
}
