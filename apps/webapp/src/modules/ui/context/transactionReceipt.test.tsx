import { type ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isUserRejectedRequestError } from '@/modules/utils/isUserRejectedRequestError';

const viem = vi.hoisted(() => ({
  waitForTransactionReceipt: vi.fn(),
  getTransactionReceipt: vi.fn(),
  getTransaction: vi.fn(),
  getTransactionCount: vi.fn(),
  getBlockNumber: vi.fn(),
  getBlock: vi.fn()
}));
const chain = vi.hoisted(() => ({ current: 1, clientsFor: [] as (number | undefined)[] }));
vi.mock('viem/actions', async io => ({
  ...(await io<typeof import('viem/actions')>()),
  waitForTransactionReceipt: viem.waitForTransactionReceipt,
  getTransactionReceipt: viem.getTransactionReceipt,
  getTransaction: viem.getTransaction,
  getTransactionCount: viem.getTransactionCount,
  getBlockNumber: viem.getBlockNumber,
  getBlock: viem.getBlock
}));
vi.mock('wagmi', () => ({ useConfig: () => ({}), useChainId: () => chain.current }));
vi.mock('@wagmi/core', () => ({
  getPublicClient: (_config: unknown, { chainId }: { chainId?: number }) => {
    chain.clientsFor.push(chainId);
    return {};
  }
}));

import {
  TransactionNotFoundError,
  TransactionReceiptNotFoundError,
  WaitForTransactionReceiptTimeoutError
} from 'viem';
import { useTransactionReceipt } from '@/hooks/shared/useTransactionReceipt';

const HASH = '0xabc' as const;
const receipt = (status: 'success' | 'reverted') => ({ status, transactionHash: HASH });

function render(props: { hash?: `0x${string}`; chainId?: number } = { hash: HASH, chainId: 1 }) {
  const client = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(p => useTransactionReceipt(p), { wrapper, initialProps: props });
}

// Default: nothing mined yet and the RPC hasn't seen the tx, so each attempt
// goes to viem's waitForTransactionReceipt.
function notMinedYet() {
  viem.getTransactionReceipt.mockRejectedValue(new TransactionReceiptNotFoundError({ hash: HASH }));
  viem.getTransaction.mockRejectedValue(new TransactionNotFoundError({ hash: HASH }));
}

describe('useTransactionReceipt', () => {
  beforeEach(notMinedYet);
  afterEach(() => {
    vi.clearAllMocks();
    chain.current = 1;
    chain.clientsFor = [];
  });

  it('reports a mined receipt as a success', async () => {
    viem.waitForTransactionReceipt.mockResolvedValue(receipt('success'));
    const { result } = render();
    expect(result.current.isPending).toBe(true);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.failure).toBeNull();
  });

  it('reports a reverted receipt as a failure, from the receipt status alone', async () => {
    viem.waitForTransactionReceipt.mockResolvedValue(receipt('reverted'));
    const { result } = render();
    await waitFor(() => expect(result.current.failure).not.toBeNull());
    expect(result.current.isSuccess).toBe(false);
    expect(result.current.isPending).toBe(false);
    expect(isUserRejectedRequestError(result.current.failure!)).toBe(false);
  });

  it('keeps watching through an RPC error instead of reporting it', async () => {
    viem.waitForTransactionReceipt
      .mockRejectedValueOnce(new Error('HTTP request failed. Status: 429'))
      .mockResolvedValueOnce(receipt('success'));
    const { result } = render();
    await waitFor(() => expect(viem.waitForTransactionReceipt).toHaveBeenCalledTimes(1));
    expect(result.current.isPending).toBe(true);
    expect(result.current.failure).toBeNull();
    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 3_000 });
    expect(viem.waitForTransactionReceipt).toHaveBeenCalledTimes(2);
  });

  it('bounds each attempt and starts the next one straight away when it times out', async () => {
    viem.waitForTransactionReceipt
      .mockRejectedValueOnce(new WaitForTransactionReceiptTimeoutError({ hash: HASH }))
      .mockResolvedValueOnce(receipt('success'));
    const started = Date.now();
    const { result } = render();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(Date.now() - started).toBeLessThan(900);
    expect(viem.waitForTransactionReceipt.mock.calls[0][1]).toMatchObject({ hash: HASH, timeout: 60_000 });
  });

  it('settles from a receipt the RPC already has, without waiting', async () => {
    viem.getTransactionReceipt.mockResolvedValue(receipt('success'));
    const { result } = render();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(viem.waitForTransactionReceipt).not.toHaveBeenCalled();
  });

  it('counts a speed-up as the same transaction', async () => {
    viem.waitForTransactionReceipt.mockImplementation(async (_client, { onReplaced }) => {
      onReplaced({ reason: 'repriced' });
      return receipt('success');
    });
    const { result } = render();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it.each(['cancelled', 'replaced'] as const)(
    'reports a %s transaction as a wallet rejection, though its replacement mined',
    async reason => {
      viem.waitForTransactionReceipt.mockImplementation(async (_client, { onReplaced }) => {
        onReplaced({ reason });
        return receipt('success');
      });
      const { result } = render();
      await waitFor(() => expect(result.current.failure).not.toBeNull());
      expect(result.current.isSuccess).toBe(false);
      expect(isUserRejectedRequestError(result.current.failure!)).toBe(true);
    }
  );

  it('keeps watching on the chain the hash was sent to when the wallet switches chains', async () => {
    viem.waitForTransactionReceipt
      .mockRejectedValueOnce(new Error('HTTP request failed. Status: 503'))
      .mockResolvedValueOnce(receipt('success'));
    const { result, rerender } = render({ hash: HASH });
    await waitFor(() => expect(viem.waitForTransactionReceipt).toHaveBeenCalledTimes(1));

    // The wallet moves to Base while the mainnet tx is pending.
    chain.current = 8453;
    rerender({ hash: HASH });
    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 3_000 });
    expect(chain.clientsFor).toEqual([1, 1]);
  });

  it('stops retrying once nothing watches the hash', async () => {
    viem.waitForTransactionReceipt.mockRejectedValue(new Error('HTTP request failed. Status: 503'));
    const { unmount } = render();
    await waitFor(() => expect(viem.waitForTransactionReceipt).toHaveBeenCalledTimes(1));
    unmount();
    await new Promise(r => setTimeout(r, 3_500));
    expect(viem.waitForTransactionReceipt.mock.calls.length).toBeLessThanOrEqual(2);
  });

  // viem detects a replacement only through the original fetched in the same
  // call: once an attempt has failed and the original is gone, a fresh attempt
  // can't see it. The hook keeps the original across attempts and finds what
  // used its nonce.
  describe('a replacement that mined while an attempt was failing', () => {
    const FROM = '0x00000000000000000000000000000000000000aa';
    const POOL = '0x00000000000000000000000000000000000000bb';
    const sent = { hash: HASH, from: FROM, to: POOL, value: 0n, input: '0xdeposit', nonce: 5 };

    function replacedDuringOutage(mined: Record<string, unknown>) {
      viem.getTransaction.mockResolvedValue(sent);
      viem.getBlockNumber.mockResolvedValueOnce(100n).mockResolvedValue(110n);
      // Attempt 1: still pending, then the RPC fails mid-wait.
      viem.getTransactionCount.mockResolvedValueOnce(5);
      viem.waitForTransactionReceipt.mockRejectedValueOnce(new Error('HTTP request failed. Status: 503'));
      // Attempt 2: the nonce has moved on (block 104 used it); the original never mined.
      viem.getTransactionCount.mockImplementation(
        async (_client: unknown, { blockNumber }: { blockNumber?: bigint }) =>
          blockNumber === undefined || blockNumber >= 104n ? 6 : 5
      );
      viem.getBlock.mockImplementation(
        async (_client: unknown, { blockNumber }: { blockNumber: bigint }) => ({
          transactions:
            blockNumber === 104n
              ? [{ from: '0x0000000000000000000000000000000000000001', nonce: 9 }, mined]
              : []
        })
      );
      viem.getTransactionReceipt.mockImplementation(async (_client: unknown, { hash }: { hash: string }) => {
        if (hash === mined.hash) return { status: 'success', transactionHash: mined.hash };
        throw new TransactionReceiptNotFoundError({ hash: hash as `0x${string}` });
      });
    }

    it('reports a cancel as a wallet rejection', async () => {
      replacedDuringOutage({ hash: '0xcancel', from: FROM, to: FROM, value: 0n, input: '0x', nonce: 5 });
      const { result } = render();
      await waitFor(() => expect(result.current.failure).not.toBeNull(), { timeout: 3_000 });
      expect(isUserRejectedRequestError(result.current.failure!)).toBe(true);
      expect(viem.getBlock).toHaveBeenCalledWith(expect.anything(), {
        blockNumber: 104n,
        includeTransactions: true
      });
    });

    it('reports a speed-up as a success', async () => {
      replacedDuringOutage({ ...sent, hash: '0xfaster' });
      const { result } = render();
      await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 3_000 });
    });

    it('reports an unrelated transaction at that nonce as a wallet rejection', async () => {
      replacedDuringOutage({ hash: '0xother', from: FROM, to: POOL, value: 1n, input: '0x', nonce: 5 });
      const { result } = render();
      await waitFor(() => expect(result.current.failure).not.toBeNull(), { timeout: 3_000 });
      expect(isUserRejectedRequestError(result.current.failure!)).toBe(true);
    });

    it('reports the original itself, when that is what used the nonce', async () => {
      replacedDuringOutage({ ...sent });
      const { result } = render();
      await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 3_000 });
    });
  });
});
