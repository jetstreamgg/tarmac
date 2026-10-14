import { type ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isUserRejectedRequestError } from '@/modules/utils/isUserRejectedRequestError';

const viem = vi.hoisted(() => ({ waitForTransactionReceipt: vi.fn() }));
const chain = vi.hoisted(() => ({ current: 1, clientsFor: [] as (number | undefined)[] }));
vi.mock('viem/actions', async io => ({
  ...(await io<typeof import('viem/actions')>()),
  waitForTransactionReceipt: viem.waitForTransactionReceipt
}));
vi.mock('wagmi', () => ({ useConfig: () => ({}), useChainId: () => chain.current }));
vi.mock('@wagmi/core', () => ({
  getPublicClient: (_config: unknown, { chainId }: { chainId?: number }) => {
    chain.clientsFor.push(chainId);
    return {};
  }
}));

import { WaitForTransactionReceiptTimeoutError } from 'viem';
import { useTransactionOutcome } from '@/hooks/shared/useTransactionOutcome';

const HASH = '0xabc' as const;
const receipt = (status: 'success' | 'reverted') => ({ status, transactionHash: HASH });

function render(props: { hash?: `0x${string}`; chainId?: number } = { hash: HASH, chainId: 1 }) {
  const client = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(p => useTransactionOutcome(p), { wrapper, initialProps: props });
}

describe('useTransactionOutcome', () => {
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

  it('starts the next attempt straight away when one times out', async () => {
    viem.waitForTransactionReceipt
      .mockRejectedValueOnce(new WaitForTransactionReceiptTimeoutError({ hash: HASH }))
      .mockResolvedValueOnce(receipt('success'));
    const { result } = render();
    // Well inside the 1s an RPC failure would wait.
    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 500 });
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
      expect(result.current.failure!.name).toBe('TransactionReplacedError');
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
});
