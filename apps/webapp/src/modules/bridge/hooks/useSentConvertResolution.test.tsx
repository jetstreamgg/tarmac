/**
 * @vitest-environment happy-dom
 */
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cctpSwapStore } from '../store/cctpSwapStore';
import { pendingScopeKey } from '../store/pendingStore';
import { useSentConvertResolution } from './useSentConvertResolution';

// After a reload, a stopped swap's bundled convert is settled from the wallet, on any page.

const mocks = vi.hoisted(() => ({ address: undefined as string | undefined, getCallsStatus: vi.fn() }));

vi.mock('wagmi', () => ({
  useConnection: () => ({ address: mocks.address }),
  useChainId: () => 1,
  useChains: () => [{ id: 1 }],
  useConfig: () => ({})
}));
vi.mock('@wagmi/core', () => ({ getCallsStatus: mocks.getCallsStatus }));

const SWAP_HASH = '0x' + 'ab'.repeat(32);
let accountSeq = 0;
const scope = () => pendingScopeKey({ account: mocks.address!, familyChainId: 1 });
const seedSwap = () =>
  cctpSwapStore.record(scope(), {
    swapTxHash: SWAP_HASH,
    network: 'base',
    usdcAmount: 1n,
    recipient: mocks.address!,
    at: 1
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

describe('useSentConvertResolution', () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.address = `0x${(3000 + ++accountSeq).toString(16).padStart(40, '0')}`;
    mocks.getCallsStatus.mockReset();
  });

  it('drops a swap whose bundled convert the wallet reports ran', async () => {
    seedSwap();
    cctpSwapStore.markConvert(scope(), SWAP_HASH, 'calls-id', { bundle: true });
    mocks.getCallsStatus.mockResolvedValue({
      status: 'success',
      receipts: [{ status: 'success', transactionHash: '0xconvert', blockNumber: 1n, logs: [] }]
    });
    renderResolution();
    await waitFor(() => expect(stored()).toBeUndefined());
    expect(mocks.getCallsStatus).toHaveBeenCalledWith(expect.anything(), { id: 'calls-id' });
  });

  it('offers the swap again once the wallet reports its convert bundle failed', async () => {
    seedSwap();
    cctpSwapStore.markConvert(scope(), SWAP_HASH, 'calls-id', { bundle: true });
    mocks.getCallsStatus.mockResolvedValue({ status: 'failure', receipts: [] });
    renderResolution();
    await waitFor(() => expect(stored()?.convert).toBeUndefined());
    expect(stored()).toBeDefined();
  });

  it('asks the wallet nothing until a convert is sent as a bundle', async () => {
    seedSwap();
    cctpSwapStore.markConvert(scope(), SWAP_HASH, '0xconvert');
    mocks.getCallsStatus.mockResolvedValue({ status: 'pending' });
    renderResolution();
    await settle();
    expect(mocks.getCallsStatus).not.toHaveBeenCalled();
    act(() => cctpSwapStore.markConvert(scope(), SWAP_HASH, 'calls-id', { bundle: true }));
    await waitFor(() => expect(mocks.getCallsStatus).toHaveBeenCalledTimes(1));
    expect(stored()).toMatchObject({ convert: 'calls-id', convertBundled: true });
  });
});
