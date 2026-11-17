/**
 * @vitest-environment happy-dom
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { encodeAbiParameters, encodeEventTopics, erc20Abi, parseUnits, zeroAddress, type Hex } from 'viem';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { L1_USDC } from '../adapters/cctp/contracts';
import { applyProgress, createPendingBridge, recordAction } from '../model/pendingTransitions';
import { resolveBridgeRoute } from '../model/resolveRoute';
import { openCctpSpend } from '../store/openCctpSpends';
import { pendingBridgeStore } from '../store/pendingStore';
import { markSaleIntent } from '../store/saleIntentStore';
import { useCctpConvertOffer } from './useCctpConvertOffer';

const ACCOUNT = '0x71C7656EC7ab88b098defB751B7401B5f6d8976F';
const SCOPE = 'bridgePending:lostSale';
const USDC = (amount: string) => parseUnits(amount, 6);

const mocks = vi.hoisted(() => ({
  receipt: vi.fn(),
  getLogs: vi.fn(),
  getBlockNumber: vi.fn()
}));

vi.mock('wagmi', () => ({ useConfig: () => ({}) }));
vi.mock('wagmi/actions', () => ({
  getPublicClient: () => ({
    getTransactionReceipt: mocks.receipt,
    getLogs: mocks.getLogs,
    getBlockNumber: mocks.getBlockNumber
  })
}));
vi.mock('./usePendingScope', () => ({
  usePendingScope: () => ({ account: ACCOUNT, familyChainId: 1, scope: SCOPE })
}));
vi.mock('@/hooks', () => ({
  useTokenBalance: (params: Record<string, unknown>) => ({
    data: params.enabled ? { value: USDC('500'), decimals: 6 } : undefined
  })
}));

// The claim's receipt: USDC minted, none sold.
const usdcMint = {
  address: L1_USDC,
  topics: encodeEventTopics({
    abi: erc20Abi,
    eventName: 'Transfer',
    args: { from: zeroAddress, to: ACCOUNT }
  }) as [Hex, ...Hex[]],
  data: encodeAbiParameters([{ type: 'uint256' }], [1n])
};

const claimed = () => {
  const now = Date.now();
  const resolved = resolveBridgeRoute({
    from: 'base',
    to: 'ethereum',
    amount: 1n,
    facts: { cctp: { isOpen: true } }
  });
  if (resolved.status !== 'ok') throw new Error(resolved.reason);
  const ready = applyProgress(
    createPendingBridge({
      account: ACCOUNT,
      amount: parseUnits('100', 18),
      from: 'base',
      to: 'ethereum',
      route: resolved.route,
      txHash: '0xburnoffer',
      now
    }),
    { kind: 'ready', nextAction: 'claim' },
    now
  );
  return applyProgress(
    recordAction(ready, { action: 'claim', txHash: '0xclaim', at: now }),
    { kind: 'arrived' },
    now
  );
};

const render = (bridge: ReturnType<typeof claimed>) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
  return renderHook(() => useCctpConvertOffer(bridge, Date.now()), { wrapper }).result;
};
const settle = () => new Promise(resolve => setTimeout(resolve, 20));

describe('useCctpConvertOffer, after a sale prompt a reload lost', () => {
  let bridge: ReturnType<typeof claimed>;

  beforeEach(() => {
    localStorage.clear();
    mocks.receipt.mockReset().mockResolvedValue({ status: 'success', logs: [usdcMint] });
    mocks.getLogs.mockReset().mockResolvedValue([]);
    mocks.getBlockNumber.mockReset().mockResolvedValue(1_000n);
    bridge = claimed();
    pendingBridgeStore.upsert(SCOPE, bridge);
  });

  it('reads no logs with no lost prompt: the usual offer costs no scan', async () => {
    const result = render(bridge);
    await waitFor(() => expect(result.current.offer).toBe(USDC('100')));
    expect(mocks.getLogs).not.toHaveBeenCalled();
  });

  it("reads no logs for this page's own prompt still open", async () => {
    markSaleIntent(SCOPE, bridge.id, Date.now());
    const release = openCctpSpend(SCOPE, bridge.id);
    const result = render(bridge);
    await waitFor(() => expect(result.current.offer).toBe(USDC('100')));
    expect(mocks.getLogs).not.toHaveBeenCalled();
    release();
  });

  it('offers again once the read finds no sale', async () => {
    markSaleIntent(SCOPE, bridge.id, Date.now());
    const result = render(bridge);
    expect(result.current.offer).toBeUndefined();
    await waitFor(() => expect(result.current.offer).toBe(USDC('100')));
    expect(mocks.getLogs).toHaveBeenCalledTimes(1);
  });

  it('offers nothing once the read finds the sale, and the card follows it as its convert', async () => {
    markSaleIntent(SCOPE, bridge.id, Date.now());
    mocks.getLogs.mockResolvedValue([{ transactionHash: '0xsale', args: { value: USDC('100') } }]);
    const result = render(bridge);
    await waitFor(() =>
      expect(
        pendingBridgeStore.getSnapshot(SCOPE).find(entry => entry.id === bridge.id)!.actions
      ).toContainEqual(expect.objectContaining({ action: 'convert', txHash: '0xsale', status: 'sent' }))
    );
    await settle();
    expect(result.current.offer).toBeUndefined();
    expect(result.current.nothingLeft).toBe(false);
  });

  it('offers nothing and keeps the card while the read fails', async () => {
    markSaleIntent(SCOPE, bridge.id, Date.now());
    mocks.getLogs.mockRejectedValue(new Error('rpc down'));
    const result = render(bridge);
    await waitFor(() => expect(mocks.getLogs).toHaveBeenCalled());
    await settle();
    expect(result.current.offer).toBeUndefined();
    expect(result.current.nothingLeft).toBe(false);
  });
});
