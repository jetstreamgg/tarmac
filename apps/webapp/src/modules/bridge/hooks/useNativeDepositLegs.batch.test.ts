/**
 * @vitest-environment happy-dom
 */
import { createElement, type ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TransactionRefusedError } from '@/hooks/shared/useTransactionOutcome';
import { getAddress, parseEther } from 'viem';
import type { TxCallbacks } from '@/modules/ui/context/transactionContract';
import { useNativeDepositLegs } from './useNativeDepositLegs';

const AMOUNT = parseEther('25');
const PROMPT_OPEN = new TransactionRefusedError(
  'Approve or reject the request in your wallet before sending again.'
);
// The open bundles are counted per account across mounts: each test signs with its own.
let accounts = 0;
const nextAccount = () =>
  getAddress(`0x71c7656ec7ab88b098defb751b74${(++accounts).toString(16).padStart(12, '0')}`);
let SENDER = nextAccount();

type EngineArgs = {
  enabled?: boolean;
  forceAtomic?: boolean;
  chainId?: number;
  simulateEnabled?: boolean;
  onMutate: (variables?: unknown) => void;
  onStart: (hash?: string) => void;
  onSuccess: (hash?: string, blockNumber?: bigint) => void;
  onError: (error: Error, hash?: string) => void;
  onCallsSent?: (id: string) => void;
};

const mocks = vi.hoisted(() => ({
  allowance: 0n,
  batchUnavailable: false,
  batchExecute: vi.fn(),
  batchReset: vi.fn(),
  sequentialExecute: vi.fn(),
  // The engine holds a reset run whose write is still out.
  sequentialDetached: false,
  batchArgs: [] as EngineArgs[],
  sequentialArgs: [] as EngineArgs[]
}));

vi.mock('wagmi', async io => ({
  ...(await io<typeof import('wagmi')>()),
  usePublicClient: () => ({ readContract: () => Promise.resolve(1n) })
}));
vi.mock('@/hooks', () => ({
  useTokenAllowance: (args: { contractAddress?: string }) => ({
    data: args.contractAddress ? mocks.allowance : undefined,
    error: null,
    mutate: vi.fn()
  })
}));
vi.mock('@/hooks/shared/useSendBatchTransactionFlow', () => ({
  useSendBatchTransactionFlow: (args: EngineArgs) => {
    mocks.batchArgs.push(args);
    return {
      execute: mocks.batchExecute,
      reset: mocks.batchReset,
      prepared: !!args.enabled,
      isLoading: false,
      error: null,
      currentCallIndex: 0,
      batchUnavailable: mocks.batchUnavailable
    };
  }
}));
vi.mock('@/hooks/shared/useSequentialTransactionFlow', () => ({
  useSequentialTransactionFlow: (args: EngineArgs) => {
    mocks.sequentialArgs.push(args);
    return {
      execute: mocks.sequentialExecute,
      reset: vi.fn(),
      detached: mocks.sequentialDetached,
      prepared: !!args.enabled,
      isLoading: false,
      error: null,
      currentCallIndex: 0
    };
  }
}));

const makeCallbacks = (): TxCallbacks => ({
  onMutate: vi.fn(),
  onStart: vi.fn(),
  onSuccess: vi.fn(),
  onError: vi.fn()
});
let current = makeCallbacks();

function renderLegs(batch = true, onCallsSent?: (id: string) => void) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  return renderHook(
    ({ account }: { account: string }) =>
      useNativeDepositLegs({
        enabled: true,
        to: 'base',
        chainId: 1,
        account,
        recipient: undefined,
        amount: AMOUNT,
        batch,
        onCallsSent,
        getCallbacks: () => current
      }),
    { wrapper, initialProps: { account: SENDER } }
  );
}

const batchEngine = () => mocks.batchArgs.at(-1)!;
const sequentialEngine = () => mocks.sequentialArgs.at(-1)!;
const settle = async () => {
  for (let i = 0; i < 5; i++) await act(() => new Promise(resolve => setTimeout(resolve, 0)));
};
// Confirm, then the engine hands the bundle to the wallet.
const confirmBundle = async (execute: () => void) => {
  act(() => execute());
  await waitFor(() => expect(mocks.batchExecute).toHaveBeenCalled());
  act(() => batchEngine().onMutate());
};

describe('useNativeDepositLegs, a batch wallet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(mocks, {
      allowance: 0n,
      batchUnavailable: false,
      sequentialDetached: false,
      batchArgs: [],
      sequentialArgs: []
    });
    current = makeCallbacks();
    SENDER = nextAccount();
  });

  it('sends the approve and the deposit as one atomic bundle, and keeps the sequential flow off', async () => {
    const { result } = renderLegs();
    await settle();
    expect(result.current.isBatch).toBe(true);
    expect(batchEngine()).toMatchObject({ enabled: true, forceAtomic: true, chainId: 1 });
    expect(sequentialEngine().enabled).toBe(false);
    act(() => result.current.execute());
    await waitFor(() => expect(mocks.batchExecute).toHaveBeenCalledTimes(1));
    expect(mocks.sequentialExecute).not.toHaveBeenCalled();
  });

  it('signs one leg at a time with batching off', async () => {
    const { result } = renderLegs(false);
    await settle();
    expect(result.current.isBatch).toBe(false);
    expect(batchEngine().enabled).toBe(false);
    act(() => result.current.execute());
    await waitFor(() => expect(mocks.sequentialExecute).toHaveBeenCalledTimes(1));
    expect(mocks.batchExecute).not.toHaveBeenCalled();
  });

  it('sends a lone deposit, with no approve, on its own', async () => {
    mocks.allowance = AMOUNT;
    const { result } = renderLegs();
    await settle();
    expect(result.current.isBatch).toBe(false);
    expect(sequentialEngine().enabled).toBe(true);
  });

  it('falls back to one leg at a time when the RPC cannot simulate the bundle', async () => {
    mocks.batchUnavailable = true;
    const { result } = renderLegs();
    await settle();
    expect(result.current.isBatch).toBe(false);
    expect(sequentialEngine().enabled).toBe(true);
  });

  it('keeps a bundle in the wallet on the batch route, though its simulation then fails', async () => {
    const { result, rerender } = renderLegs();
    await settle();
    await confirmBundle(result.current.execute);
    mocks.batchUnavailable = true;
    rerender({ account: SENDER });
    expect(result.current.isBatch).toBe(true);
    expect(sequentialEngine().enabled).toBe(false);
    expect(batchEngine().simulateEnabled).toBe(false);
  });

  it('sends nothing more while the wallet has not answered a bundle, even after the modal closed', async () => {
    const { result } = renderLegs();
    await settle();
    await confirmBundle(result.current.execute);
    act(() => result.current.execute());
    await settle();
    expect(current.onError).toHaveBeenCalledWith(PROMPT_OPEN, '');
    act(() => result.current.reset());
    current = makeCallbacks();
    act(() => result.current.execute());
    await settle();
    expect(current.onError).toHaveBeenCalledTimes(1);
    expect(mocks.batchExecute).toHaveBeenCalledTimes(1);
    expect(mocks.sequentialExecute).not.toHaveBeenCalled();
  });

  it('reports a bundle accepted after its modal closed to its own Confirm', async () => {
    const { result } = renderLegs();
    await settle();
    const first = current;
    await confirmBundle(result.current.execute);
    act(() => result.current.reset());
    current = makeCallbacks();
    act(() => batchEngine().onStart(undefined));
    expect(first.onStart).toHaveBeenCalledWith(undefined);
    expect(current.onStart).not.toHaveBeenCalled();
  });

  it('drops a bundle rejected after its modal closed, and frees the next Confirm', async () => {
    const { result } = renderLegs();
    await settle();
    await confirmBundle(result.current.execute);
    act(() => result.current.reset());
    current = makeCallbacks();
    act(() => batchEngine().onError(new Error('User rejected the request.'), undefined));
    expect(current.onError).not.toHaveBeenCalled();
    act(() => result.current.execute());
    await waitFor(() => expect(mocks.batchExecute).toHaveBeenCalledTimes(2));
  });

  it('reports a rejection in its own run, and Retry may bundle again', async () => {
    const { result } = renderLegs();
    await settle();
    await confirmBundle(result.current.execute);
    const error = new Error('User rejected the request.');
    act(() => batchEngine().onError(error, undefined));
    expect(current.onError).toHaveBeenCalledWith(error, undefined);
    act(() => result.current.execute());
    await waitFor(() => expect(mocks.batchExecute).toHaveBeenCalledTimes(2));
  });

  it('reports the accepted bundle and its success to the current Confirm', async () => {
    const { result } = renderLegs();
    await settle();
    await confirmBundle(result.current.execute);
    act(() => batchEngine().onStart(undefined));
    act(() => batchEngine().onSuccess('0xhash', 9n));
    expect(current.onStart).toHaveBeenCalledWith(undefined);
    expect(current.onSuccess).toHaveBeenCalledWith('0xhash', 9n);
  });

  it('keeps the bundle counted open after the form remounts, until the wallet answers it', async () => {
    const first = renderLegs();
    await settle();
    await confirmBundle(first.result.current.execute);
    const engine = batchEngine();
    first.unmount();
    const { result } = renderLegs();
    await settle();
    act(() => result.current.execute());
    await settle();
    expect(current.onError).toHaveBeenCalledWith(PROMPT_OPEN, '');
    expect(mocks.batchExecute).toHaveBeenCalledTimes(1);
    act(() => engine.onError(new Error('User rejected the request.'), undefined));
    act(() => result.current.execute());
    await waitFor(() => expect(mocks.batchExecute).toHaveBeenCalledTimes(2));
  });

  it('blocks a one-by-one Confirm of the same account while its bundle is open', async () => {
    const bundled = renderLegs();
    await settle();
    await confirmBundle(bundled.result.current.execute);
    const { result } = renderLegs(false);
    await settle();
    act(() => result.current.execute());
    await settle();
    expect(current.onError).toHaveBeenCalledWith(PROMPT_OPEN, '');
    expect(mocks.sequentialExecute).not.toHaveBeenCalled();
  });

  it("never blocks another account's Confirm", async () => {
    const bundled = renderLegs();
    await settle();
    await confirmBundle(bundled.result.current.execute);
    SENDER = nextAccount();
    const { result } = renderLegs();
    await settle();
    act(() => result.current.execute());
    await waitFor(() => expect(mocks.batchExecute).toHaveBeenCalledTimes(2));
    expect(current.onError).not.toHaveBeenCalled();
  });

  // The engine would sign the reset run's frozen calls under the new Confirm.
  it('refuses a new Confirm while a one-by-one window of the reset run is still open', async () => {
    const { result, rerender } = renderLegs(false);
    await settle();
    act(() => result.current.execute());
    await waitFor(() => expect(mocks.sequentialExecute).toHaveBeenCalledTimes(1));
    act(() => sequentialEngine().onMutate({ functionName: 'approve' }));
    act(() => result.current.reset());
    mocks.sequentialDetached = true;
    rerender({ account: SENDER });
    expect(result.current.busy).toBe(true);
    current = makeCallbacks();
    act(() => result.current.execute());
    await settle();
    expect(current.onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringMatching(/still open in your wallet or pending/) }),
      ''
    );
    expect(mocks.sequentialExecute).toHaveBeenCalledTimes(1);
  });

  it('reports a refusal of the engine, which opened no window, and leaves the next Confirm free', async () => {
    const refusal = new Error('ERROR: A batch transaction failed simulation');
    mocks.batchExecute.mockImplementationOnce(() => batchEngine().onError(refusal, undefined));
    const { result } = renderLegs();
    await settle();
    act(() => result.current.execute());
    await waitFor(() => expect(current.onError).toHaveBeenCalledWith(refusal, undefined));
    act(() => result.current.execute());
    await waitFor(() => expect(mocks.batchExecute).toHaveBeenCalledTimes(2));
  });

  it("keeps an earlier account's open bundle counted when the engine refuses the next account's", async () => {
    const { result, rerender } = renderLegs();
    await settle();
    const first = SENDER;
    await confirmBundle(result.current.execute);
    SENDER = nextAccount();
    rerender({ account: SENDER });
    await settle();
    mocks.batchExecute.mockImplementationOnce(() => batchEngine().onError(new Error('refused'), undefined));
    act(() => result.current.execute());
    await waitFor(() => expect(mocks.batchExecute).toHaveBeenCalledTimes(2));
    SENDER = first;
    const again = renderLegs();
    await settle();
    current = makeCallbacks();
    act(() => again.result.current.execute());
    await settle();
    expect(current.onError).toHaveBeenCalledWith(PROMPT_OPEN, '');
    expect(mocks.batchExecute).toHaveBeenCalledTimes(2);
  });

  it("drops an earlier bundle's success once a new bundle is sent", async () => {
    const { result } = renderLegs();
    await settle();
    const first = current;
    await confirmBundle(result.current.execute);
    act(() => batchEngine().onStart(undefined));
    act(() => result.current.reset());
    current = makeCallbacks();
    await confirmBundle(result.current.execute);
    act(() => batchEngine().onSuccess('0xold', 9n));
    expect(first.onSuccess).not.toHaveBeenCalled();
    expect(current.onSuccess).not.toHaveBeenCalled();
  });

  it('drops the success of a bundle whose modal closed: recovery resolves its card', async () => {
    const { result } = renderLegs();
    await settle();
    const first = current;
    await confirmBundle(result.current.execute);
    act(() => batchEngine().onStart(undefined));
    act(() => result.current.reset());
    current = makeCallbacks();
    act(() => batchEngine().onSuccess('0xhash', 9n));
    expect(first.onSuccess).not.toHaveBeenCalled();
    expect(current.onSuccess).not.toHaveBeenCalled();
    expect(mocks.batchReset).toHaveBeenCalled();
  });

  it('reports a failed bundle to its own Confirm after its modal closed, so its card fails', async () => {
    const { result } = renderLegs();
    await settle();
    const first = current;
    await confirmBundle(result.current.execute);
    act(() => batchEngine().onStart(undefined));
    act(() => result.current.reset());
    current = makeCallbacks();
    const failed = new Error('ERROR: Batch transaction failed');
    act(() => batchEngine().onError(failed, undefined));
    expect(first.onError).toHaveBeenCalledWith(failed, undefined);
    expect(current.onError).not.toHaveBeenCalled();
  });

  it('keeps waiting for an accepted bundle when its modal closes', async () => {
    const { result } = renderLegs();
    await settle();
    await confirmBundle(result.current.execute);
    act(() => batchEngine().onStart(undefined));
    mocks.batchReset.mockClear();
    act(() => result.current.reset());
    expect(mocks.batchReset).not.toHaveBeenCalled();
  });

  it('passes the id the wallet accepted the bundle under', async () => {
    const onCallsSent = vi.fn();
    const { result } = renderLegs(true, onCallsSent);
    await settle();
    await confirmBundle(result.current.execute);
    act(() => batchEngine().onCallsSent?.('0xcalls'));
    expect(onCallsSent).toHaveBeenCalledWith('0xcalls');
  });
});
