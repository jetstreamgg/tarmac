/**
 * @vitest-environment happy-dom
 */
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cctpSwapStore } from '../store/cctpSwapStore';
import { pendingScopeKey } from '../store/pendingStore';
import { useSentConvertResolution } from './useSentConvertResolution';

// After a reload, a stopped swap's convert sent by hash is settled from its receipt on the swap's L2, on any page.

const BASE = 8453;
const mocks = vi.hoisted(() => ({
  address: undefined as string | undefined,
  chains: [] as { id: number }[],
  getCallsStatus: vi.fn(),
  getTransactionReceipt: vi.fn(),
  getPublicClient: vi.fn()
}));

vi.mock('wagmi', () => ({
  useConnection: () => ({ address: mocks.address }),
  useChainId: () => 1,
  useChains: () => mocks.chains,
  useConfig: () => ({})
}));
vi.mock('wagmi/actions', () => ({
  getCallsStatus: mocks.getCallsStatus,
  getPublicClient: mocks.getPublicClient
}));

const SWAP_HASH = '0x' + 'ab'.repeat(32);
const CONVERT = '0x' + 'ef'.repeat(32);
let accountSeq = 0;
const scope = () => pendingScopeKey({ account: mocks.address!, familyChainId: 1 });
const seedSentConvert = () => {
  cctpSwapStore.record(scope(), {
    swapTxHash: SWAP_HASH,
    network: 'base',
    usdcAmount: 1n,
    recipient: mocks.address!,
    at: 1
  });
  cctpSwapStore.markConvert(scope(), SWAP_HASH, CONVERT);
};
const stored = () => cctpSwapStore.get(scope(), SWAP_HASH);

const renderResolution = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useSentConvertResolution(), { wrapper });
};
const settle = () => new Promise(resolve => setTimeout(resolve, 20));

describe('useSentConvertResolution, a convert sent by hash', () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.address = `0x${(4000 + ++accountSeq).toString(16).padStart(40, '0')}`;
    mocks.chains = [{ id: 1 }, { id: BASE }];
    mocks.getCallsStatus.mockReset();
    mocks.getTransactionReceipt.mockReset();
    mocks.getPublicClient.mockReset();
    mocks.getPublicClient.mockReturnValue({ getTransactionReceipt: mocks.getTransactionReceipt });
  });

  it('drops a swap whose convert mined, read on its L2', async () => {
    seedSentConvert();
    mocks.getTransactionReceipt.mockResolvedValue({ status: 'success' });
    renderResolution();
    await waitFor(() => expect(stored()).toBeUndefined());
    expect(mocks.getPublicClient).toHaveBeenCalledWith(expect.anything(), { chainId: BASE });
    expect(mocks.getTransactionReceipt).toHaveBeenCalledWith({ hash: CONVERT });
    expect(mocks.getCallsStatus).not.toHaveBeenCalled();
  });

  it('offers the swap again once its convert reverted', async () => {
    seedSentConvert();
    mocks.getTransactionReceipt.mockResolvedValue({ status: 'reverted' });
    renderResolution();
    await waitFor(() => expect(stored()?.convert).toBeUndefined());
    expect(stored()).toBeDefined();
  });

  it('keeps the convert sent while it is not mined', async () => {
    seedSentConvert();
    mocks.getTransactionReceipt.mockRejectedValue(new Error('Transaction receipt could not be found'));
    renderResolution();
    await waitFor(() => expect(mocks.getTransactionReceipt).toHaveBeenCalled());
    await settle();
    expect(stored()).toMatchObject({ convert: CONVERT });
  });

  it('reads no chain the app cannot switch to', async () => {
    mocks.chains = [{ id: 1 }];
    seedSentConvert();
    mocks.getTransactionReceipt.mockResolvedValue({ status: 'reverted' });
    renderResolution();
    await settle();
    expect(mocks.getPublicClient).not.toHaveBeenCalled();
    expect(stored()).toMatchObject({ convert: CONVERT });
  });
});
