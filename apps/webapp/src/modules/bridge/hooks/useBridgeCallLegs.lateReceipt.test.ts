/**
 * @vitest-environment happy-dom
 */
// APP-649: a send signed after its run ended is followed to its receipt; an RPC error never reads as a failure.
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getAddress, type Call, type PublicClient } from 'viem';
import type { TxMutateVariables } from '@/hooks';
import { useBridgeCallLegs } from './useBridgeCallLegs';

type FlowArgs = {
  onMutate: (variables?: TxMutateVariables) => void;
  onStart: (hash?: string, variables?: TxMutateVariables) => void;
};

const mocks = vi.hoisted(() => ({ flows: [] as FlowArgs[] }));

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
vi.mock('@/hooks/shared/useSequentialTransactionFlow', () => ({
  useSequentialTransactionFlow: (args: FlowArgs) => {
    mocks.flows.push(args);
    return { prepared: true, error: null, execute: vi.fn(), reset: vi.fn(), nextCalls: [] };
  }
}));

const SENDER = getAddress('0x71C7656EC7ab88b098defB751B7401B5f6d8976F');
const CALLS = [{ to: SENDER, data: '0x01' }] as Call[];
const DEPOSIT = { functionName: 'depositETHTo', args: [] } as unknown as TxMutateVariables;
const callbacks = { onMutate: vi.fn(), onStart: vi.fn(), onSuccess: vi.fn(), onError: vi.fn() };

/** Signs the deposit after its run was reset, so only the late follow-up reads its receipt. */
async function signLate(waitForTransactionReceipt: ReturnType<typeof vi.fn>) {
  const { result, unmount } = renderHook(() =>
    useBridgeCallLegs({
      calls: CALLS,
      chainId: 1,
      client: { waitForTransactionReceipt } as unknown as PublicClient,
      from: SENDER,
      sendFunctionName: 'depositETHTo',
      preflight: async () => undefined,
      getCallbacks: () => callbacks
    })
  );
  await act(async () => result.current.execute());
  act(() => mocks.flows.at(-1)!.onMutate(DEPOSIT));
  act(() => result.current.reset());
  act(() => mocks.flows.at(-1)!.onStart('0xdeposit', DEPOSIT));
  return unmount;
}

describe('useBridgeCallLegs: a late send whose receipt read fails', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.flows = [];
    Object.values(callbacks).forEach(fn => fn.mockClear());
  });
  afterEach(() => vi.useRealTimers());

  it('reads it again until it mines, and never reports a failure', async () => {
    const wait = vi
      .fn()
      .mockRejectedValueOnce(new Error('HTTP request failed'))
      .mockRejectedValueOnce(new Error('HTTP request failed'))
      .mockResolvedValue({ status: 'success', blockNumber: 9n });
    await signLate(wait);
    await act(async () => vi.advanceTimersByTimeAsync(10_000));
    expect(wait).toHaveBeenCalledTimes(3);
    expect(callbacks.onError).not.toHaveBeenCalled();
    expect(callbacks.onSuccess).toHaveBeenCalledWith('0xdeposit', 9n);
  });

  it('keeps it pending while the RPC keeps failing', async () => {
    const wait = vi.fn().mockRejectedValue(new Error('HTTP request failed'));
    const unmount = await signLate(wait);
    await act(async () => vi.advanceTimersByTimeAsync(10 * 60_000));
    expect(wait.mock.calls.length).toBeGreaterThan(5);
    expect(callbacks.onError).not.toHaveBeenCalled();
    expect(callbacks.onSuccess).not.toHaveBeenCalled();
    // Unmounted, its card's tracker follows it instead.
    unmount();
    const calls = wait.mock.calls.length;
    await act(async () => vi.advanceTimersByTimeAsync(60_000));
    expect(wait.mock.calls.length).toBeLessThanOrEqual(calls + 1);
  });
});
