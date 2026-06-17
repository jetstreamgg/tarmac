import { renderHook, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Call } from 'viem';

// Regression guard for "bug #1" — premature SUCCESS in the non-batch sequential
// flow. An "approve then deposit" sequence must fire the shared onSuccess only
// after the FINAL (deposit) receipt mines, never after the approve. Downstream,
// onSuccess flips the TransactionModal to SUCCESS and shows "Done"; firing it
// early lets the user close the modal before the deposit runs.
//
// The engine (useBatchSavingsSupply) builds `calls` reactively from the live
// allowance — after the approve mines, the allowance refetches and `calls`
// shrinks from [approve, supply] to [supply]. This suite drives that shrink and
// asserts the contract holds regardless: onSuccess fires once, only after the
// second receipt.

// Controllable wagmi seam. vi.hoisted so the vi.mock factory can close over it.
const wagmi = vi.hoisted(() => ({
  // mutation callbacks captured from useWriteContract({ mutation })
  onMutate: undefined as undefined | (() => void),
  onWriteSuccess: undefined as undefined | ((hash: `0x${string}`) => void),
  onWriteError: undefined as undefined | ((err: Error) => void),
  writeContract: vi.fn(),
  resetWrite: vi.fn(),
  // current write mutation hash (drives useWaitForTransactionReceipt)
  mutationHash: undefined as `0x${string}` | undefined,
  // current receipt state, keyed off the active hash by the test driver
  receipt: {
    isLoading: false,
    isSuccess: false,
    error: null as Error | null,
    failureReason: null as Error | null
  }
}));

vi.mock('wagmi', () => ({
  useConnection: () => ({ connector: undefined }),
  useSimulateContract: () => ({ data: { request: { __mock: 'request' } }, isLoading: false, error: null }),
  useWriteContract: (opts: {
    mutation: {
      onMutate?: () => void;
      onSuccess?: (hash: `0x${string}`) => void;
      onError?: (err: Error) => void;
    };
  }) => {
    wagmi.onMutate = opts.mutation.onMutate;
    wagmi.onWriteSuccess = opts.mutation.onSuccess;
    wagmi.onWriteError = opts.mutation.onError;
    return {
      writeContract: wagmi.writeContract,
      error: null,
      data: wagmi.mutationHash,
      reset: wagmi.resetWrite
    };
  },
  useWaitForTransactionReceipt: () => wagmi.receipt
}));

// Safe-connector hash workaround is irrelevant here (connector is undefined).
vi.mock('@/hooks/shared/useWaitForSafeTxHash', () => ({
  useWaitForSafeTxHash: () => undefined
}));

import { useSequentialTransactionFlow } from '@/hooks/shared/useSequentialTransactionFlow';

function makeCall(functionName: string): Call {
  return {
    to: '0x0000000000000000000000000000000000000001',
    abi: [],
    functionName,
    args: []
  } as unknown as Call;
}
const APPROVE = makeCall('approve');
const SUPPLY = makeCall('supply');

function resetWagmi() {
  wagmi.onMutate = undefined;
  wagmi.onWriteSuccess = undefined;
  wagmi.onWriteError = undefined;
  wagmi.writeContract = vi.fn();
  wagmi.resetWrite = vi.fn();
  wagmi.mutationHash = undefined;
  wagmi.receipt = { isLoading: false, isSuccess: false, error: null, failureReason: null };
}

describe('useSequentialTransactionFlow — premature SUCCESS guard (bug #1)', () => {
  beforeEach(resetWagmi);
  afterEach(() => vi.clearAllMocks());

  it('fires onSuccess exactly once, only after the SECOND receipt — even when calls shrinks to [supply] after the approve', () => {
    const onSuccess = vi.fn();
    const onStart = vi.fn();
    const onError = vi.fn();
    let calls: Call[] = [APPROVE, SUPPLY];

    const { result, rerender } = renderHook(() =>
      useSequentialTransactionFlow({ calls, onSuccess, onStart, onError })
    );

    // Confirm clicked → execute() freezes [approve, supply] (length 2) and signs
    // the approve.
    act(() => result.current.execute());
    expect(wagmi.writeContract).toHaveBeenCalledTimes(1);

    // The approve mutation lands: wallet returns its hash → onStart, hash becomes
    // visible to useWaitForTransactionReceipt on the next render.
    act(() => {
      wagmi.mutationHash = '0xapprove';
      wagmi.onWriteSuccess?.('0xapprove');
    });
    rerender();
    expect(onStart).toHaveBeenLastCalledWith('0xapprove');

    // Approve receipt mines.
    act(() => {
      wagmi.receipt = { isLoading: false, isSuccess: true, error: null, failureReason: null };
    });
    rerender();

    // THE regression guard: onSuccess must NOT have fired after the approve.
    expect(onSuccess).not.toHaveBeenCalled();
    // The flow advanced to the second call.
    expect(result.current.currentCallIndex).toBe(1);

    // The allowance refetched → calls shrinks from length 2 to length 1. The
    // completion check must still treat the deposit as the final tx, not the
    // first-of-one.
    calls = [SUPPLY];
    act(() => {
      // supply auto-executes (writeContract is inert here); drive its mutation.
      wagmi.receipt = { isLoading: false, isSuccess: false, error: null, failureReason: null };
      wagmi.mutationHash = '0xsupply';
      wagmi.onWriteSuccess?.('0xsupply');
    });
    rerender();

    // Still not fired between the two receipts.
    expect(onSuccess).not.toHaveBeenCalled();

    // Supply receipt mines → the final completion.
    act(() => {
      wagmi.receipt = { isLoading: false, isSuccess: true, error: null, failureReason: null };
    });
    rerender();

    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledWith('0xsupply');
    expect(onError).not.toHaveBeenCalled();
  });

  it('single-call sequence fires onSuccess once after its receipt', () => {
    const onSuccess = vi.fn();
    const calls: Call[] = [SUPPLY];

    const { result, rerender } = renderHook(() => useSequentialTransactionFlow({ calls, onSuccess }));

    act(() => result.current.execute());
    expect(wagmi.writeContract).toHaveBeenCalledTimes(1);

    act(() => {
      wagmi.mutationHash = '0xsupply';
      wagmi.onWriteSuccess?.('0xsupply');
    });
    rerender();

    expect(onSuccess).not.toHaveBeenCalled();

    act(() => {
      wagmi.receipt = { isLoading: false, isSuccess: true, error: null, failureReason: null };
    });
    rerender();

    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledWith('0xsupply');
    expect(result.current.currentCallIndex).toBe(0); // reset on completion
  });

  it('an error on the first (approve) receipt does not fire onSuccess', () => {
    const onSuccess = vi.fn();
    const onError = vi.fn();
    const calls: Call[] = [APPROVE, SUPPLY];

    const { result, rerender } = renderHook(() =>
      useSequentialTransactionFlow({ calls, onSuccess, onError })
    );

    act(() => result.current.execute());

    act(() => {
      wagmi.mutationHash = '0xapprove';
      wagmi.onWriteSuccess?.('0xapprove');
    });
    rerender();

    // Approve receipt fails (a plain mining error, not a revert).
    const miningError = new Error('approve mining failed');
    act(() => {
      wagmi.receipt = { isLoading: false, isSuccess: false, error: miningError, failureReason: null };
    });
    rerender();

    expect(onSuccess).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][1]).toBe('0xapprove');
  });
});
