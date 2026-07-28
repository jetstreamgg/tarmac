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

  // APP-417. `useSimulateContract` hands back a NEW object whenever it refetches —
  // on window focus as the user returns from the wallet, or (on a repeat flow) as a
  // cache hit is followed by a background refetch. The supply's own hash is not
  // recorded until it MINES, so `!transactionHashes[currentIndex]` left the whole
  // submit→mine window open and every such refetch re-fired writeContract: a second
  // supply tx in the wallet, plus a second onMutate that pushed the modal's step
  // counter past the last step, rendering "Supply" completed before it mined.
  it('dispatches the second call ONCE even as the simulation keeps re-resolving mid-flight', () => {
    const onSuccess = vi.fn();
    const calls: Call[] = [APPROVE, SUPPLY];

    const { result, rerender } = renderHook(() => useSequentialTransactionFlow({ calls, onSuccess }));

    act(() => result.current.execute());
    expect(wagmi.writeContract).toHaveBeenCalledTimes(1); // approve

    act(() => {
      wagmi.mutationHash = '0xapprove';
      wagmi.onWriteSuccess?.('0xapprove');
    });
    rerender();

    // Approve mines → the flow advances and auto-executes the supply.
    act(() => {
      wagmi.receipt = { isLoading: false, isSuccess: true, error: null, failureReason: null };
    });
    rerender();

    expect(result.current.currentCallIndex).toBe(1);
    expect(wagmi.writeContract).toHaveBeenCalledTimes(2); // approve + supply

    // The supply is now in the wallet, unsigned: no hash, no receipt. The mocked
    // useSimulateContract returns a fresh object on every render, so these rerenders
    // reproduce the refetch churn that used to re-fire the write.
    act(() => {
      wagmi.receipt = { isLoading: false, isSuccess: false, error: null, failureReason: null };
    });
    rerender();
    rerender();
    rerender();

    expect(wagmi.writeContract).toHaveBeenCalledTimes(2); // still just the two

    // And the supply still completes normally once its receipt lands.
    act(() => {
      wagmi.mutationHash = '0xsupply';
      wagmi.onWriteSuccess?.('0xsupply');
    });
    rerender();
    act(() => {
      wagmi.receipt = { isLoading: false, isSuccess: true, error: null, failureReason: null };
    });
    rerender();

    expect(wagmi.writeContract).toHaveBeenCalledTimes(2);
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledWith('0xsupply');
  });

  it('a second flow on the same mounted hook dispatches each call once', () => {
    const onSuccess = vi.fn();
    const calls: Call[] = [APPROVE, SUPPLY];

    const { result, rerender } = renderHook(() => useSequentialTransactionFlow({ calls, onSuccess }));

    const runFlow = (approveHash: `0x${string}`, supplyHash: `0x${string}`) => {
      act(() => result.current.execute());
      act(() => {
        wagmi.mutationHash = approveHash;
        wagmi.onWriteSuccess?.(approveHash);
      });
      rerender();
      act(() => {
        wagmi.receipt = { isLoading: false, isSuccess: true, error: null, failureReason: null };
      });
      rerender();
      // supply auto-executed; let the simulation churn while it is unsigned
      act(() => {
        wagmi.receipt = { isLoading: false, isSuccess: false, error: null, failureReason: null };
      });
      rerender();
      rerender();
      act(() => {
        wagmi.mutationHash = supplyHash;
        wagmi.onWriteSuccess?.(supplyHash);
      });
      rerender();
      act(() => {
        wagmi.receipt = { isLoading: false, isSuccess: true, error: null, failureReason: null };
      });
      rerender();
    };

    runFlow('0xapprove1', '0xsupply1');
    expect(wagmi.writeContract).toHaveBeenCalledTimes(2);
    expect(onSuccess).toHaveBeenCalledTimes(1);

    // Reopening the modal and supplying again — the latch must have been released
    // on completion, and must still hold for this flow's own second call.
    act(() => {
      wagmi.receipt = { isLoading: false, isSuccess: false, error: null, failureReason: null };
    });
    rerender();
    runFlow('0xapprove2', '0xsupply2');

    expect(wagmi.writeContract).toHaveBeenCalledTimes(4); // 2 per flow, not 3
    expect(onSuccess).toHaveBeenCalledTimes(2);
    expect(onSuccess).toHaveBeenLastCalledWith('0xsupply2');
  });

  // Retrying a wallet rejection mid-sequence. `handleRetry` calls the config's
  // onConfirm, which is this execute(). By then the approve has mined and the live
  // `calls` has shrunk to [supply], so bounds-checking currentIndex (1) against it
  // swallowed the retry entirely and the modal's "Try again" did nothing.
  it('a retry after the wallet rejects the second call re-dispatches it', () => {
    const onError = vi.fn();
    let calls: Call[] = [APPROVE, SUPPLY];

    const { result, rerender } = renderHook(() => useSequentialTransactionFlow({ calls, onError }));

    act(() => result.current.execute());
    act(() => {
      wagmi.mutationHash = '0xapprove';
      wagmi.onWriteSuccess?.('0xapprove');
    });
    rerender();
    act(() => {
      wagmi.receipt = { isLoading: false, isSuccess: true, error: null, failureReason: null };
    });
    rerender();

    expect(result.current.currentCallIndex).toBe(1);
    expect(wagmi.writeContract).toHaveBeenCalledTimes(2); // approve + supply

    // The allowance landed, so the engine's live `calls` drops the approve.
    calls = [SUPPLY];
    // The user rejects the supply in their wallet.
    act(() => {
      wagmi.mutationHash = undefined;
      wagmi.onWriteError?.(new Error('User rejected the request'));
    });
    rerender();
    expect(onError).toHaveBeenCalledTimes(1);

    // "Try again" must actually hand the supply back to the wallet.
    act(() => result.current.execute());
    expect(wagmi.writeContract).toHaveBeenCalledTimes(3);

    // And the retried supply still completes the sequence exactly once.
    act(() => {
      wagmi.mutationHash = '0xsupply';
      wagmi.onWriteSuccess?.('0xsupply');
    });
    rerender();
    act(() => {
      wagmi.receipt = { isLoading: false, isSuccess: true, error: null, failureReason: null };
    });
    rerender();

    expect(wagmi.writeContract).toHaveBeenCalledTimes(3);
    expect(result.current.currentCallIndex).toBe(0); // sequence completed and reset
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
