import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PublicClient } from 'viem';
import { getBatchExecutorCode, resetBatchExecutorCodeCache } from './batchExecutorCode';

const clientReturning = (getCode: () => Promise<string | undefined>) =>
  ({ getCode: vi.fn(getCode) }) as unknown as PublicClient & { getCode: ReturnType<typeof vi.fn> };

afterEach(() => {
  resetBatchExecutorCodeCache();
});

describe('getBatchExecutorCode', () => {
  it('gives concurrent callers the same miss, and reads again afterwards', async () => {
    const client = clientReturning(async () => '0x');

    // The fee estimate and the simulation both ask on modal open.
    const [first, second] = await Promise.all([getBatchExecutorCode(client), getBatchExecutorCode(client)]);
    expect(first).toBeUndefined();
    expect(second).toBeUndefined();
    expect(client.getCode).toHaveBeenCalledTimes(1);

    // A miss isn't kept.
    await getBatchExecutorCode(client);
    expect(client.getCode).toHaveBeenCalledTimes(2);
  });

  it('keeps a found deployment for the session', async () => {
    const client = clientReturning(async () => '0x6080');

    expect(await getBatchExecutorCode(client)).toBe('0x6080');
    expect(await getBatchExecutorCode(client)).toBe('0x6080');
    expect(client.getCode).toHaveBeenCalledTimes(1);
  });

  it('does not keep a failed read', async () => {
    const client = clientReturning(async () => {
      throw new Error('rpc down');
    });

    await expect(getBatchExecutorCode(client)).rejects.toThrow('rpc down');
    await expect(getBatchExecutorCode(client)).rejects.toThrow('rpc down');
    expect(client.getCode).toHaveBeenCalledTimes(2);
  });
});
