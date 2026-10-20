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
  receipt: vi.fn(),
  balance: {
    params: undefined as undefined | Record<string, unknown>,
    value: undefined as bigint | undefined
  },
  clientChainIds: [] as number[]
}));

vi.mock('wagmi', () => ({ useConfig: () => ({}) }));
vi.mock('@wagmi/core', () => ({
  getPublicClient: (_config: unknown, { chainId }: { chainId: number }) => {
    mocks.clientChainIds.push(chainId);
    return { getTransactionReceipt: mocks.receipt };
  }
}));
vi.mock('./usePendingScope', () => ({
  usePendingScope: () => ({ account: mocks.account, familyChainId: 1, scope: 'scope' })
}));
vi.mock('@/hooks', () => ({
  useTokenBalance: (params: Record<string, unknown>) => {
    mocks.balance.params = params;
    return {
      data:
        params.enabled && mocks.balance.value !== undefined
          ? { value: mocks.balance.value, decimals: 6 }
          : undefined
    };
  }
}));

const transfer = (token: Hex, to: Hex) => ({
  address: token,
  topics: encodeEventTopics({ abi: erc20Abi, eventName: 'Transfer', args: { from: zeroAddress, to } }) as [
    Hex,
    ...Hex[]
  ],
  data: encodeAbiParameters([{ type: 'uint256' }], [1n])
});

const claimed = (claim = true) => {
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
      txHash: '0xburn',
      now: NOW
    }),
    { kind: 'ready', nextAction: 'claim' },
    NOW
  );
  return claim ? recordAction(ready, { action: 'claim', txHash: '0xclaim', at: NOW }) : ready;
};

const render = (bridge = claimed()) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
  return renderHook(() => useCctpConvertOffer(bridge), { wrapper }).result;
};

describe('useCctpConvertOffer', () => {
  beforeEach(() => {
    mocks.account = ACCOUNT;
    mocks.receipt.mockReset();
    mocks.balance = { params: undefined, value: USDC('500') };
    mocks.clientChainIds = [];
  });

  it("offers the minted USDC when the claim's receipt shows no USDS minted", async () => {
    mocks.receipt.mockResolvedValue({ status: 'success', logs: [transfer(L1_USDC, ACCOUNT)] });
    const result = render();
    await waitFor(() => expect(result.current).toBe(USDC('100')));
    expect(mocks.receipt).toHaveBeenCalledWith({ hash: '0xclaim' });
    expect(mocks.clientChainIds).toContain(1);
    expect(mocks.balance.params).toMatchObject({
      address: ACCOUNT,
      token: L1_USDC,
      chainId: 1,
      enabled: true
    });
  });

  it('offers nothing when the claim sold it', async () => {
    mocks.receipt.mockResolvedValue({ status: 'success', logs: [transfer(L1_USDS, ACCOUNT)] });
    const result = render();
    await waitFor(() => expect(mocks.receipt).toHaveBeenCalled());
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(result.current).toBeUndefined();
  });

  it("offers nothing while the receipt can't be read, or for a reverted one", async () => {
    mocks.receipt.mockRejectedValue(new Error('rpc down'));
    const failed = render();
    await waitFor(() => expect(mocks.receipt).toHaveBeenCalled());
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(failed.current).toBeUndefined();

    mocks.receipt.mockResolvedValue({ status: 'reverted', logs: [] });
    const reverted = render();
    await waitFor(() => expect(mocks.receipt).toHaveBeenCalledTimes(2));
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(reverted.current).toBeUndefined();
  });

  it('reads nothing for a bridge with no claim this app confirmed, or for another account', () => {
    expect(render(claimed(false)).current).toBeUndefined();
    // Claimed by someone else: arrived, with no claim this app recorded.
    expect(render(applyProgress(claimed(false), { kind: 'arrived' }, NOW)).current).toBeUndefined();
    mocks.account = `0x${'2'.repeat(40)}`;
    expect(render().current).toBeUndefined();
    expect(mocks.receipt).not.toHaveBeenCalled();
    expect(mocks.balance.params).toMatchObject({ enabled: false });
  });

  it('offers nothing while the balance is unknown', async () => {
    mocks.balance.value = undefined;
    mocks.receipt.mockResolvedValue({ status: 'success', logs: [] });
    const result = render();
    await waitFor(() => expect(mocks.receipt).toHaveBeenCalled());
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(result.current).toBeUndefined();
  });
});
