/**
 * @vitest-environment happy-dom
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { encodeAbiParameters, encodeEventTopics, erc20Abi, parseUnits, zeroAddress, type Hex } from 'viem';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { L1_USDC, L1_USDS } from '../adapters/cctp/contracts';
import { applyProgress, createPendingBridge, recordAction } from '../model/pendingTransitions';
import { resolveBridgeRoute } from '../model/resolveRoute';
import { useCctpConvertOffer } from './useCctpConvertOffer';

const ACCOUNT = '0x71C7656EC7ab88b098defB751B7401B5f6d8976F';
const NOW = 1_800_000_000_000;
const USDC = (amount: string) => parseUnits(amount, 6);

const mocks = vi.hoisted(() => ({
  account: '' as string | undefined,
  find: vi.fn(),
  receipt: vi.fn(),
  // USDS minted to the recipient after the receive, as getLogs returns them.
  mints: [] as { transactionHash: Hex; blockNumber: bigint; args: { value: bigint } }[],
  getLogs: undefined as (() => Promise<unknown>) | undefined,
  usdc: undefined as bigint | undefined,
  clientChainIds: [] as number[]
}));

vi.mock('wagmi', () => ({ useConfig: () => ({}) }));
vi.mock('wagmi/actions', () => ({
  getPublicClient: (_config: unknown, { chainId }: { chainId: number }) => {
    mocks.clientChainIds.push(chainId);
    return {
      chainId,
      getTransactionReceipt: mocks.receipt,
      getBlockNumber: async () => 100n,
      getLogs: async () => (mocks.getLogs ? mocks.getLogs() : mocks.mints)
    };
  }
}));
vi.mock('./usePendingScope', () => ({
  usePendingScope: () => ({ account: mocks.account, familyChainId: 1, scope: 'scope' })
}));
vi.mock('@/hooks', () => ({
  useTokenBalance: (params: { enabled: boolean }) => ({
    data: params.enabled && mocks.usdc !== undefined ? { value: mocks.usdc, decimals: 6 } : undefined
  })
}));
vi.mock('../adapters/cctp/convert', async importOriginal => ({
  ...(await importOriginal<typeof import('../adapters/cctp/convert')>()),
  findOthersClaimReceipt: mocks.find
}));

const mint = (token: Hex, to: Hex) => ({
  address: token,
  topics: encodeEventTopics({ abi: erc20Abi, eventName: 'Transfer', args: { from: zeroAddress, to } }),
  data: encodeAbiParameters([{ type: 'uint256' }], [1n])
});

const bridge = () => {
  const resolved = resolveBridgeRoute({
    from: 'base',
    to: 'ethereum',
    amount: 1n,
    facts: { cctp: { isOpen: true } }
  });
  if (resolved.status !== 'ok') throw new Error(resolved.reason);
  return createPendingBridge({
    account: ACCOUNT,
    amount: parseUnits('100', 18),
    from: 'base',
    to: 'ethereum',
    route: resolved.route,
    txHash: '0xburn',
    now: NOW
  });
};
// Claimed by someone else: the tracker saw the nonce used, with no claim this app recorded.
const othersClaimed = () => applyProgress(bridge(), { kind: 'arrived' }, NOW);

const render = (pending = othersClaimed()) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
  return renderHook(() => useCctpConvertOffer(pending), { wrapper }).result;
};

const settle = () => new Promise(resolve => setTimeout(resolve, 10));

// APP-653: a claim fairy, the sender or the recipient elsewhere can claim; only the recipient converts.
describe('useCctpConvertOffer, after a claim someone else sent', () => {
  beforeEach(() => {
    mocks.account = ACCOUNT;
    mocks.find.mockReset();
    mocks.receipt.mockReset();
    mocks.mints = [];
    mocks.getLogs = undefined;
    mocks.usdc = USDC('500');
    mocks.clientChainIds = [];
  });

  it('offers the minted USDC when that receive sold nothing', async () => {
    mocks.find.mockResolvedValue({
      transactionHash: '0xreceive',
      blockNumber: 90n,
      logs: [mint(L1_USDC, ACCOUNT)]
    });
    const result = render();
    await waitFor(() => expect(result.current).toBe(USDC('100')));
    expect(mocks.find).toHaveBeenCalledWith(
      expect.objectContaining({ l1: expect.objectContaining({ chainId: 1 }), bridge: othersClaimed() })
    );
    expect(mocks.find.mock.calls[0][0].l2.chainId).toBe(8453);
  });

  it('offers no more than the recipient still holds', async () => {
    mocks.usdc = USDC('40');
    mocks.find.mockResolvedValue({ transactionHash: '0xreceive', blockNumber: 90n, logs: [] });
    const result = render();
    await waitFor(() => expect(result.current).toBe(USDC('40')));
  });

  it('offers nothing when that receive sold it for USDS', async () => {
    mocks.find.mockResolvedValue({
      transactionHash: '0xreceive',
      blockNumber: 90n,
      logs: [mint(L1_USDS, ACCOUNT)]
    });
    const result = render();
    await waitFor(() => expect(mocks.find).toHaveBeenCalled());
    await settle();
    expect(result.current).toBeUndefined();
  });

  it('offers nothing when the recipient sold it in a later transaction', async () => {
    mocks.find.mockResolvedValue({ transactionHash: '0xreceive', blockNumber: 90n, logs: [] });
    mocks.mints = [{ transactionHash: '0xsale', blockNumber: 91n, args: { value: parseUnits('100', 18) } }];
    const result = render();
    await waitFor(() => expect(mocks.find).toHaveBeenCalled());
    await settle();
    expect(result.current).toBeUndefined();
  });

  it('hides the offer once a sale signed apart mines after the receive was read', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      mocks.find.mockResolvedValue({ transactionHash: '0xreceive', blockNumber: 90n, logs: [] });
      const result = render();
      await waitFor(() => expect(result.current).toBe(USDC('100')));
      mocks.mints = [{ transactionHash: '0xsale', blockNumber: 92n, args: { value: parseUnits('100', 18) } }];
      await vi.advanceTimersByTimeAsync(60_000);
      await waitFor(() => expect(result.current).toBeUndefined());
      // The receive itself is found once.
      expect(mocks.find).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("offers nothing when the receive isn't found, or can't be read", async () => {
    mocks.find.mockResolvedValue(null);
    const missing = render();
    await waitFor(() => expect(mocks.find).toHaveBeenCalled());
    await settle();
    expect(missing.current).toBeUndefined();

    mocks.find.mockRejectedValue(new Error('rpc down'));
    const failed = render();
    await waitFor(() => expect(mocks.find).toHaveBeenCalledTimes(2));
    await settle();
    expect(failed.current).toBeUndefined();
  });

  it('scans again each minute after a failed scan, and not after one that found nothing', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const found = { transactionHash: '0xreceive', blockNumber: 90n, logs: [] };
      mocks.find.mockRejectedValueOnce(new Error('rpc down')).mockResolvedValue(found);
      const failed = render();
      await waitFor(() => expect(mocks.find).toHaveBeenCalledTimes(1));
      expect(failed.current).toBeUndefined();
      await vi.advanceTimersByTimeAsync(60_000);
      await waitFor(() => expect(failed.current).toBe(USDC('100')));

      mocks.find.mockReset();
      mocks.find.mockResolvedValueOnce(null).mockResolvedValue(found);
      const missing = render();
      await waitFor(() => expect(mocks.find).toHaveBeenCalledTimes(1));
      await vi.advanceTimersByTimeAsync(120_000);
      expect(mocks.find).toHaveBeenCalledTimes(1);
      expect(missing.current).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it('reads a sale check that failed again, and offers only once it reads unsold', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      mocks.find.mockResolvedValue({ transactionHash: '0xreceive', blockNumber: 90n, logs: [] });
      let reads = 0;
      mocks.getLogs = async () => {
        reads += 1;
        if (reads === 1) throw new Error('rpc down');
        return [];
      };
      const result = render();
      await waitFor(() => expect(reads).toBe(1));
      await settle();
      expect(result.current).toBeUndefined();
      await vi.advanceTimersByTimeAsync(60_000);
      await waitFor(() => expect(result.current).toBe(USDC('100')));
    } finally {
      vi.useRealTimers();
    }
  });

  it('scans nothing while the recipient holds no USDC, or its balance is unknown', async () => {
    mocks.usdc = 0n;
    expect(render().current).toBeUndefined();
    mocks.usdc = undefined;
    expect(render().current).toBeUndefined();
    await settle();
    expect(mocks.find).not.toHaveBeenCalled();
  });

  it('reads nothing for an account that is not the recipient', async () => {
    mocks.account = `0x${'2'.repeat(40)}`;
    expect(render().current).toBeUndefined();
    await settle();
    expect(mocks.find).not.toHaveBeenCalled();
  });

  it('never scans for a claim this app confirmed: its own receipts tell', async () => {
    const own = recordAction(applyProgress(bridge(), { kind: 'ready', nextAction: 'claim' }, NOW), {
      action: 'claim',
      txHash: '0xclaim',
      at: NOW
    });
    mocks.receipt.mockResolvedValue({ status: 'success', logs: [mint(L1_USDC, ACCOUNT)] });
    const result = render(own);
    await waitFor(() => expect(result.current).toBe(USDC('100')));
    expect(mocks.find).not.toHaveBeenCalled();
  });
});
