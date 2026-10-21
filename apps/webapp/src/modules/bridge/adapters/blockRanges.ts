/**
 * The block ranges of at most `size` blocks that cover `from` to `to` once,
 * oldest first, or newest first with `newestFirst`. For log reads that RPC
 * providers cap by block range.
 */
export function* blockRanges(
  from: bigint,
  to: bigint,
  size: bigint,
  { newestFirst = false }: { newestFirst?: boolean } = {}
): Generator<{ fromBlock: bigint; toBlock: bigint }> {
  if (from > to) return;
  if (newestFirst) {
    for (let end = to; end >= from; end -= size) {
      const start = end - size + 1n > from ? end - size + 1n : from;
      yield { fromBlock: start, toBlock: end };
      if (start === from) return;
    }
    return;
  }
  for (let start = from; start <= to; start += size) {
    yield { fromBlock: start, toBlock: start + size - 1n < to ? start + size - 1n : to };
  }
}
