/**
 * @vitest-environment happy-dom
 */
import { createElement, type ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAddress, parseEther, type Call } from 'viem';
import { arbitrum } from 'wagmi/chains';
import { retryableQuote } from '../adapters/nativeDeposit/arbitrum';
import { ARBITRUM_DEPOSIT, L1_USDS, OP_STACK_DEPOSIT } from '../adapters/nativeDeposit/contracts';
import { OP_STACK_MIN_GAS_LIMIT } from '../adapters/nativeDeposit/opStack';
import { useNativeDepositLegs } from './useNativeDepositLegs';

const SENDER = getAddress('0x71C7656EC7ab88b098defB751B7401B5f6d8976F');
const RECIPIENT = getAddress('0x2546BcD3c84621e976D8185a91A922aE77ECEc30');
const AMOUNT = parseEther('25');
const ESTIMATES = { submissionFee: 510_224_272_976n, gasEstimate: 116_946n, l2GasPrice: 10_000_000n };

const mocks = vi.hoisted(() => ({
  fee: vi.fn<() => Promise<bigint>>(),
  allowance: undefined as bigint | undefined,
  allowanceError: null as Error | null,
  allowanceArgs: [] as { chainId: number; contractAddress?: string; owner?: string; spender?: string }[],
  flow: { prepared: true, error: null as Error | null },
  flowArgs: [] as { calls: Call[]; enabled: boolean; chainId?: number; failOnReplaced?: boolean }[],
  clientChains: [] as (number | undefined)[]
}));

vi.mock('wagmi', async io => ({
  ...(await io<typeof import('wagmi')>()),
  usePublicClient: ({ chainId }: { chainId?: number }) => {
    mocks.clientChains.push(chainId);
    return chainId === 42161
      ? {
          estimateContractGas: () => Promise.resolve(ESTIMATES.gasEstimate),
          estimateGas: () => Promise.resolve(ESTIMATES.gasEstimate),
          getGasPrice: () => Promise.resolve(ESTIMATES.l2GasPrice)
        }
      : { readContract: () => mocks.fee() };
  }
}));
vi.mock('@/hooks', () => ({
  useTokenAllowance: (args: (typeof mocks.allowanceArgs)[number]) => {
    mocks.allowanceArgs.push(args);
    return {
      data: args.contractAddress ? mocks.allowance : undefined,
      error: mocks.allowanceError,
      mutate: vi.fn()
    };
  }
}));
vi.mock('@/hooks/shared/useSequentialTransactionFlow', () => ({
  useSequentialTransactionFlow: (args: (typeof mocks.flowArgs)[number]) => {
    mocks.flowArgs.push(args);
    return { ...mocks.flow, execute: vi.fn(), reset: vi.fn() };
  }
}));

const callbacks = { onMutate: vi.fn(), onStart: vi.fn(), onSuccess: vi.fn(), onError: vi.fn() };

type LegsProps = Partial<Parameters<typeof useNativeDepositLegs>[0]>;

function renderLegs(props: LegsProps = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  return renderHook(
    (rerendered: LegsProps) =>
      useNativeDepositLegs({
        enabled: true,
        to: 'arbitrum',
        chainId: 1,
        account: SENDER,
        recipient: undefined,
        amount: AMOUNT,
        getCallbacks: () => callbacks,
        ...props,
        ...rerendered
      }),
    { wrapper, initialProps: {} }
  );
}

// Lets the quote land and the hook re-render.
const settle = async () => {
  for (let i = 0; i < 5; i++) await act(() => new Promise(resolve => setTimeout(resolve, 0)));
};

describe('useNativeDepositLegs', () => {
  beforeEach(() => {
    mocks.fee.mockReset().mockResolvedValue(ESTIMATES.submissionFee);
    Object.assign(mocks, {
      allowance: 0n,
      allowanceError: null,
      allowanceArgs: [],
      flow: { prepared: true, error: null },
      flowArgs: [],
      clientChains: []
    });
  });

  it('builds the approve and deposit for the sender, priced on Ethereum and Arbitrum', async () => {
    const { result } = renderLegs();
    await settle();
    const quote = retryableQuote(ESTIMATES);
    expect(mocks.clientChains).toEqual(expect.arrayContaining([1, arbitrum.id]));
    expect(mocks.allowanceArgs.at(-1)).toMatchObject({
      chainId: 1,
      contractAddress: L1_USDS,
      owner: SENDER,
      spender: ARBITRUM_DEPOSIT.l1Gateway
    });
    expect(result.current.calls.map(call => call.functionName)).toEqual([
      'approve',
      'outboundTransferCustomRefund'
    ]);
    const [, deposit] = result.current.calls;
    expect(deposit.value).toBe(quote.value);
    // No recipient entered: the sender receives, and is refunded, on Arbitrum.
    expect((deposit.args as readonly unknown[]).slice(1, 4)).toEqual([SENDER, SENDER, AMOUNT]);
    expect(result.current).toMatchObject({
      maxFee: quote.value,
      needsApprove: true,
      ready: true,
      error: null
    });
    expect(mocks.flowArgs.at(-1)).toMatchObject({ enabled: true, chainId: 1, failOnReplaced: true });
  });

  it('sends to and refunds an entered recipient', async () => {
    const { result } = renderLegs({ recipient: RECIPIENT.toLowerCase() });
    await settle();
    const deposit = result.current.calls.at(-1)!;
    expect((deposit.args as readonly unknown[]).slice(1, 3)).toEqual([RECIPIENT, RECIPIENT]);
  });

  it('skips the approve when the allowance covers the amount', async () => {
    mocks.allowance = AMOUNT;
    const { result } = renderLegs();
    await settle();
    expect(result.current.calls.map(call => call.functionName)).toEqual(['outboundTransferCustomRefund']);
    expect(result.current.needsApprove).toBe(false);
  });

  it('builds no calls while the quote is loading', async () => {
    mocks.fee.mockReturnValue(new Promise<bigint>(() => undefined));
    const { result } = renderLegs();
    await settle();
    expect(result.current).toMatchObject({ calls: [], ready: false, maxFee: undefined });
    expect(mocks.flowArgs.at(-1)?.enabled).toBe(false);
  });

  it('builds no calls and surfaces the error when the quote fails', async () => {
    mocks.fee.mockRejectedValue(new Error('rpc down'));
    const { result } = renderLegs();
    // The quote retries once, after a second.
    await waitFor(() => expect(result.current.error).toBeInstanceOf(Error), { timeout: 3000 });
    expect(mocks.fee).toHaveBeenCalledTimes(2);
    expect(result.current).toMatchObject({ calls: [], ready: false });
  });

  it('builds no calls while the allowance is unknown, and surfaces its error', async () => {
    mocks.allowance = undefined;
    mocks.allowanceError = new Error('allowance read failed');
    const { result } = renderLegs();
    await settle();
    expect(result.current).toMatchObject({ calls: [], ready: false });
    expect(result.current.error).toBe(mocks.allowanceError);
  });

  it('is not ready, and says why, when the first leg fails to simulate', async () => {
    mocks.flow = { prepared: false, error: new Error('simulation reverted') };
    const { result } = renderLegs();
    await settle();
    expect(result.current.calls).toHaveLength(2);
    expect(result.current.ready).toBe(false);
    expect(result.current.error).toBe(mocks.flow.error);
  });

  it.each([
    ['disabled', { enabled: false }],
    ['no chain', { chainId: undefined }],
    ['no account', { account: undefined }],
    ['a zero amount', { amount: 0n }],
    ['an invalid recipient', { recipient: 'not-an-address' }]
  ])('reads and builds nothing when %s', async (_, props) => {
    mocks.allowanceError = new Error('stale');
    const { result } = renderLegs(props);
    await settle();
    expect(mocks.fee).not.toHaveBeenCalled();
    expect(mocks.allowanceArgs.at(-1)?.contractAddress).toBeUndefined();
    expect(result.current).toMatchObject({ calls: [], ready: false, error: null });
  });

  it("reports each leg to the latest session's callbacks", async () => {
    let session = callbacks;
    renderLegs({ getCallbacks: () => session });
    await settle();
    const next = { onMutate: vi.fn(), onStart: vi.fn(), onSuccess: vi.fn(), onError: vi.fn() };
    session = next;
    (mocks.flowArgs.at(-1) as unknown as { onStart: (hash: string) => void }).onStart('0xabc');
    expect(next.onStart).toHaveBeenCalledWith('0xabc');
    expect(callbacks.onStart).not.toHaveBeenCalled();
  });

  describe('to an OP Stack network', () => {
    it.each(['base', 'optimism', 'unichain'] as const)(
      'to %s approves its L1 bridge and calls bridgeERC20To for the recipient, with no ETH and no quote',
      async network => {
        const { result } = renderLegs({ to: network, recipient: RECIPIENT.toLowerCase() });
        await settle();
        const { l1TokenBridge, l2Usds } = OP_STACK_DEPOSIT[network];
        expect(mocks.fee).not.toHaveBeenCalled();
        expect(mocks.allowanceArgs.at(-1)).toMatchObject({
          chainId: 1,
          contractAddress: L1_USDS,
          owner: SENDER,
          spender: l1TokenBridge
        });
        const [approve, deposit] = result.current.calls;
        expect(approve).toMatchObject({
          to: L1_USDS,
          functionName: 'approve',
          args: [l1TokenBridge, AMOUNT]
        });
        expect(deposit).toMatchObject({
          to: l1TokenBridge,
          functionName: 'bridgeERC20To',
          args: [L1_USDS, l2Usds, RECIPIENT, AMOUNT, OP_STACK_MIN_GAS_LIMIT, '0x']
        });
        expect(deposit.value).toBeUndefined();
        expect(result.current).toMatchObject({
          maxFee: undefined,
          needsApprove: true,
          ready: true,
          error: null
        });
        expect(mocks.flowArgs.at(-1)).toMatchObject({ enabled: true, chainId: 1, failOnReplaced: true });
      }
    );

    it('sends to the sender when no recipient was entered, and skips a covered approve', async () => {
      mocks.allowance = AMOUNT;
      const { result } = renderLegs({ to: 'base' });
      await settle();
      expect(result.current.calls.map(call => call.functionName)).toEqual(['bridgeERC20To']);
      expect((result.current.calls[0].args as readonly unknown[])[2]).toBe(SENDER);
      expect(result.current.needsApprove).toBe(false);
    });

    it('shows no Arbitrum fee or quote error once switched to an OP Stack network', async () => {
      const { result, rerender } = renderLegs();
      await settle();
      expect(result.current.maxFee).toBeDefined();
      // The Arbitrum quote stays cached in the disabled query.
      rerender({ to: 'base' });
      await settle();
      expect(result.current).toMatchObject({ maxFee: undefined, ready: true, error: null });
      expect(result.current.calls.at(-1)?.functionName).toBe('bridgeERC20To');
    });
  });
});
