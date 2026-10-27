import { describe, expect, it, vi } from 'vitest';
import { encodeErrorResult, RawContractError, type PublicClient } from 'viem';
import { replayRevertedTransaction } from './replayRevertedTransaction';

const HASH = `0x${'ab'.repeat(32)}` as const;
const FROM = `0x${'11'.repeat(20)}` as const;
const TO = `0x${'22'.repeat(20)}` as const;

const urnUnsafe = encodeErrorResult({
  abi: [{ type: 'error', name: 'Error', inputs: [{ name: 'message', type: 'string' }] }],
  errorName: 'Error',
  args: ['LockstakeEngine/urn-unsafe']
});

function client(call: () => Promise<unknown>) {
  return {
    getTransaction: vi
      .fn()
      .mockResolvedValue({ from: FROM, to: TO, input: '0x1234', value: 0n, gas: 100_000n }),
    call: vi.fn(call)
  } as unknown as PublicClient & { call: ReturnType<typeof vi.fn> };
}

describe('replayRevertedTransaction', () => {
  it('replays the same call on the parent block and decodes the revert it raises', async () => {
    const c = client(() => Promise.reject(new RawContractError({ data: urnUnsafe })));
    await expect(replayRevertedTransaction(c, { transactionHash: HASH, blockNumber: 100n })).resolves.toEqual(
      {
        reason: 'LockstakeEngine/urn-unsafe',
        kind: 'error'
      }
    );
    expect(c.call).toHaveBeenCalledWith(
      expect.objectContaining({ account: FROM, to: TO, data: '0x1234', blockNumber: 99n })
    );
  });

  it('gives nothing when the replay goes through', async () => {
    const c = client(() => Promise.resolve({ data: '0x' }));
    await expect(
      replayRevertedTransaction(c, { transactionHash: HASH, blockNumber: 100n })
    ).resolves.toBeUndefined();
  });

  it('gives nothing when the transaction cannot be read', async () => {
    const c = client(() => Promise.resolve({ data: '0x' }));
    (c.getTransaction as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('not found'));
    await expect(
      replayRevertedTransaction(c, { transactionHash: HASH, blockNumber: 100n })
    ).resolves.toBeUndefined();
  });

  it('gives up after its timeout', async () => {
    vi.useFakeTimers();
    try {
      const c = client(() => new Promise(() => {}));
      const pending = replayRevertedTransaction(c, { transactionHash: HASH, blockNumber: 100n });
      await vi.advanceTimersByTimeAsync(10_000);
      await expect(pending).resolves.toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });
});
