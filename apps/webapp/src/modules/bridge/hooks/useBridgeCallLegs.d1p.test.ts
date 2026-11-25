/**
 * @vitest-environment happy-dom
 */
// A Confirm after the modal closed on an open wallet prompt must not send the closed run's calls.
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Call, PublicClient } from 'viem';
import { useBridgeCallLegs } from './useBridgeCallLegs';

const wagmi = vi.hoisted(() => ({
  onWriteSuccess: undefined as undefined | ((hash: `0x${string}`) => void),
  onWriteError: undefined as undefined | ((err: Error) => void),
  writeContract: vi.fn(),
  mutationHash: undefined as `0x${string}` | undefined,
  isPending: false,
  receipt: { isLoading: false, isSuccess: false, failure: null as Error | null }
}));

vi.mock('wagmi', () => ({
  useConnection: () => ({ connector: undefined, address: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F' }),
  // Echo the simulated call so a test sees which call a write was prepared from.
  useSimulateContract: (params: { functionName?: string; args?: unknown[] }) => ({
    data: { request: { functionName: params.functionName, args: params.args } },
    isLoading: false,
    error: null,
    refetch: async () => ({
      data: { request: { functionName: params.functionName, args: params.args } },
      error: null
    })
  }),
  useWriteContract: (opts: {
    mutation: { onSuccess?: (hash: `0x${string}`) => void; onError?: (err: Error) => void };
  }) => {
    wagmi.onWriteSuccess = opts.mutation.onSuccess;
    wagmi.onWriteError = opts.mutation.onError;
    return {
      writeContract: wagmi.writeContract,
      error: null,
      data: wagmi.mutationHash,
      isPending: wagmi.isPending,
      reset: vi.fn()
    };
  }
}));
vi.mock('@/hooks/shared/useTransactionOutcome', async io => ({
  ...(await io<typeof import('@/hooks/shared/useTransactionOutcome')>()),
  useTransactionOutcome: () => ({
    isPending: wagmi.receipt.isLoading,
    isSuccess: wagmi.receipt.isSuccess,
    failure: wagmi.receipt.failure,
    receipt: wagmi.receipt.isSuccess ? { blockNumber: 1n } : undefined
  })
}));
vi.mock('@/hooks/shared/useWaitForSafeTxHash', () => ({
  useWaitForSafeTxHash: () => ({ transactionHash: undefined, isSafeApp: false })
}));
vi.mock('@/hooks/shared/useSendBatchTransactionFlow', () => ({
  useSendBatchTransactionFlow: () => ({
    execute: vi.fn(),
    reset: vi.fn(),
    prepared: false,
    isLoading: false,
    error: null,
    currentCallIndex: 0,
    batchUnavailable: true
  })
}));

const SENDER = '0x71C7656EC7ab88b098defB751B7401B5f6d8976F';
const call = (functionName: string, marker: string) =>
  ({ to: SENDER, abi: [], functionName, args: [marker] }) as unknown as Call;
const APPROVE = call('approve', 'usdc');
const BURN_R1 = call('depositForBurn', 'R1');
const BURN_R2 = call('depositForBurn', 'R2');
const callbacks = { onMutate: vi.fn(), onStart: vi.fn(), onSuccess: vi.fn(), onError: vi.fn() };
const writes = () =>
  wagmi.writeContract.mock.calls.map(([request]) => (request as { args: string[] }).args[0]);

function setup() {
  let calls: Call[] = [APPROVE, BURN_R1];
  const view = renderHook(() =>
    useBridgeCallLegs({
      calls,
      chainId: 8453,
      client: {} as PublicClient,
      from: SENDER,
      sendFunctionName: 'depositForBurn',
      preflight: async () => undefined,
      getCallbacks: () => callbacks
    })
  );
  const setCalls = (next: Call[]) => {
    calls = next;
    view.rerender();
  };
  return { ...view, setCalls };
}

/** Run 1: Confirm, the approve mines, the burn to R1 opens in the wallet. */
async function runToBurnPrompt({ result, rerender }: ReturnType<typeof setup>) {
  await act(async () => result.current.execute());
  expect(writes()).toEqual(['usdc']);
  act(() => {
    wagmi.mutationHash = '0xapprove';
    wagmi.onWriteSuccess?.('0xapprove');
  });
  rerender();
  wagmi.receipt = { isLoading: false, isSuccess: true, failure: null };
  rerender();
  rerender();
  expect(writes()).toEqual(['usdc', 'R1']);
  wagmi.isPending = true;
  wagmi.mutationHash = undefined;
  wagmi.receipt = { isLoading: false, isSuccess: false, failure: null };
  rerender();
}

describe('useBridgeCallLegs after a close on an open wallet prompt', () => {
  beforeEach(() => {
    Object.assign(wagmi, {
      writeContract: vi.fn(),
      mutationHash: undefined,
      isPending: false,
      receipt: { isLoading: false, isSuccess: false, failure: null }
    });
  });
  afterEach(() => vi.clearAllMocks());

  // Control: the prompt was answered (rejected) before the next Confirm, so the run is cleared.
  it('control: a prompt rejected after the close lets the next Confirm send the new calls', async () => {
    const view = setup();
    await runToBurnPrompt(view);
    act(() => view.result.current.reset());
    act(() => {
      wagmi.isPending = false;
      wagmi.onWriteError?.(new Error('User rejected the request'));
    });
    view.setCalls([BURN_R2]);
    await act(async () => view.result.current.execute());
    expect(writes()).toEqual(['usdc', 'R1', 'R2']);
  });

  it('sends nothing of run 1 when a new Confirm comes while its burn prompt is still open', async () => {
    const view = setup();
    await runToBurnPrompt(view);
    // The user closes the modal; the wallet still shows the burn to R1.
    act(() => view.result.current.reset());
    // A new review, to R2 (the USDC allowance is there now).
    view.setCalls([BURN_R2]);
    expect(view.result.current.ready).toBe(true);
    await act(async () => view.result.current.execute());
    // Invariant: the burn to R1 is never sent again under the R2 review.
    expect(writes().slice(2)).not.toContain('R1');
  });
});
