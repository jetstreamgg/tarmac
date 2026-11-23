/**
 * @vitest-environment happy-dom
 */
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { TransactionNotFoundError, TransactionReceiptNotFoundError, type Hex } from 'viem';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cctpSwapStore } from '../store/cctpSwapStore';
import { pendingScopeKey } from '../store/pendingStore';
import { useSentConvertResolution } from './useSentConvertResolution';

// A stopped swap whose convert the L2 has no record of is offered again, on any page.

const BASE = 8453;
const MINUTE = 60_000;
const mocks = vi.hoisted(() => ({
  address: undefined as string | undefined,
  getCallsStatus: vi.fn(),
  getTransactionReceipt: vi.fn(),
  getTransaction: vi.fn(),
  getPublicClient: vi.fn()
}));

vi.mock('wagmi', () => ({
  useConnection: () => ({ address: mocks.address }),
  useChainId: () => 1,
  useChains: () => [{ id: 1 }, { id: BASE }],
  useConfig: () => ({})
}));
vi.mock('wagmi/actions', () => ({
  getCallsStatus: mocks.getCallsStatus,
  getPublicClient: mocks.getPublicClient
}));

const SWAP_HASH = '0x' + 'ab'.repeat(32);
const CONVERT = ('0x' + 'ef'.repeat(32)) as Hex;
let accountSeq = 0;
const scope = () => pendingScopeKey({ account: mocks.address!, familyChainId: 1 });
const seedConvertSentAgo = (ms: number) =>
  cctpSwapStore.record(scope(), {
    swapTxHash: SWAP_HASH,
    network: 'base',
    usdcAmount: 1n,
    recipient: mocks.address!,
    at: 1,
    convert: CONVERT,
    convertAt: Date.now() - ms
  });
const stored = () => cctpSwapStore.get(scope(), SWAP_HASH);

const renderResolution = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useSentConvertResolution(), { wrapper });
};
const settle = () => new Promise(resolve => setTimeout(resolve, 20));

describe('useSentConvertResolution, a convert sent by hash that never mines', () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.address = `0x${(5000 + ++accountSeq).toString(16).padStart(40, '0')}`;
    mocks.getCallsStatus.mockReset();
    mocks.getTransactionReceipt.mockReset();
    mocks.getTransaction.mockReset();
    mocks.getPublicClient.mockReset();
    mocks.getPublicClient.mockReturnValue({
      getTransactionReceipt: mocks.getTransactionReceipt,
      getTransaction: mocks.getTransaction
    });
    mocks.getTransactionReceipt.mockRejectedValue(new TransactionReceiptNotFoundError({ hash: CONVERT }));
  });

  it('offers the swap again once its L2 has had no record of the convert for 15 minutes', async () => {
    seedConvertSentAgo(16 * MINUTE);
    mocks.getTransaction.mockRejectedValue(new TransactionNotFoundError({ hash: CONVERT }));
    renderResolution();
    await waitFor(() => expect(stored()?.convert).toBeUndefined());
    expect(stored()).toBeDefined();
    expect(mocks.getPublicClient).toHaveBeenCalledWith(expect.anything(), { chainId: BASE });
    expect(mocks.getTransaction).toHaveBeenCalledWith({ hash: CONVERT });
  });

  it('keeps the convert sent while it waits in the mempool', async () => {
    seedConvertSentAgo(16 * MINUTE);
    mocks.getTransaction.mockResolvedValue({ hash: CONVERT });
    renderResolution();
    await waitFor(() => expect(mocks.getTransaction).toHaveBeenCalled());
    await settle();
    expect(stored()).toMatchObject({ convert: CONVERT });
  });

  it('keeps the convert sent when the L2 cannot be asked', async () => {
    seedConvertSentAgo(16 * MINUTE);
    mocks.getTransaction.mockRejectedValue(new Error('rate limited'));
    renderResolution();
    await waitFor(() => expect(mocks.getTransaction).toHaveBeenCalled());
    await settle();
    expect(stored()).toMatchObject({ convert: CONVERT });
  });

  it('keeps the convert sent before that', async () => {
    seedConvertSentAgo(10 * MINUTE);
    mocks.getTransaction.mockRejectedValue(new TransactionNotFoundError({ hash: CONVERT }));
    renderResolution();
    await waitFor(() => expect(mocks.getTransactionReceipt).toHaveBeenCalled());
    await settle();
    expect(stored()).toMatchObject({ convert: CONVERT });
  });
});
