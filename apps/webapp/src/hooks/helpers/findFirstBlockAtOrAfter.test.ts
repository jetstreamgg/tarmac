import { describe, expect, it, vi } from 'vitest';
import type { PublicClient } from 'viem';
import { findFirstBlockAtOrAfter } from './findFirstBlockAtOrAfter';

/**
 * A fake chain: block n's timestamp is GENESIS + 12n, except that every
 * `missEvery`-th slot is skipped (so blocks drift later than the 12s estimate,
 * like real missed slots).
 */
function fakeChain({ latest, missEvery }: { latest: bigint; missEvery?: bigint }) {
  const GENESIS = 1_000_000n;
  const timestampOf = (n: bigint) => GENESIS + 12n * (n + (missEvery ? n / missEvery : 0n));
  const getBlock = vi.fn(async ({ blockNumber }: { blockNumber?: bigint } = {}) => {
    const number = blockNumber ?? latest;
    return { number, timestamp: timestampOf(number) };
  });
  return { client: { getBlock } as unknown as PublicClient, getBlock, timestampOf };
}

describe('findFirstBlockAtOrAfter', () => {
  it('lands on the exact block on a chain with no missed slots', async () => {
    const { client, timestampOf } = fakeChain({ latest: 1_000_000n });
    const target = Number(timestampOf(400_000n));
    expect(await findFirstBlockAtOrAfter(client, target)).toBe(400_000n);
    // Between two blocks → the later one.
    expect(await findFirstBlockAtOrAfter(client, target + 5)).toBe(400_001n);
  });

  it('converges through missed slots in a handful of reads', async () => {
    const { client, getBlock, timestampOf } = fakeChain({ latest: 1_000_000n, missEvery: 97n });
    const target = Number(timestampOf(250_000n));
    expect(await findFirstBlockAtOrAfter(client, target)).toBe(250_000n);
    expect(getBlock.mock.calls.length).toBeLessThanOrEqual(8);
  });

  it('throws for a timestamp the chain has not reached yet', async () => {
    const { client, timestampOf } = fakeChain({ latest: 1_000n });
    await expect(findFirstBlockAtOrAfter(client, Number(timestampOf(2_000n)))).rejects.toThrow();
  });
});
