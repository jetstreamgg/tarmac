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
  // the connected account
  address: undefined as string | undefined,
  // functionName → error its simulation fails with
  simulationErrors: {} as Record<string, Error>,
  // When set, a refetch resolves only after this promise does (a slow RPC).
  refetchGate: undefined as Promise<void> | undefined,
  // current write mutation hash (drives the receipt hook)
  mutationHash: undefined as `0x${string}` | undefined,
  // a write waiting in the wallet
  isPending: false,
  // current receipt state, keyed off the active hash by the test driver
  receipt: {
    isLoading: false,
    isSuccess: false,
    error: null,
    failureReason: null
  } as {
    isLoading: boolean;
    isSuccess: boolean;
    error: Error | null;
    failureReason: Error | null;
    data?: { blockNumber: bigint };
  }
}));

vi.mock('wagmi', () => ({
  useConnection: () => ({ connector: undefined, address: wagmi.address }),
  // Echo the simulated call back on the request so a test can see WHICH call a
  // dispatch was prepared from.
  useSimulateContract: (params: { functionName?: string; value?: bigint; gas?: bigint }) => {
    const simulate = () => {
      const error = params.functionName ? wagmi.simulationErrors[params.functionName] : undefined;
      return error
        ? { data: undefined, isLoading: false, error }
        : {
            data: {
              request: {
                __mock: 'request',
                functionName: params.functionName,
                value: params.value,
                gas: params.gas
              }
            },
            isLoading: false,
            error: null
          };
    };
    // Like TanStack Query, a failed refetch keeps the last good data.
    const refetch = async () => {
      if (wagmi.refetchGate) await wagmi.refetchGate;
      const result = simulate();
      return result.error
        ? { ...result, data: { request: { __mock: 'request', functionName: params.functionName } } }
        : result;
    };
    return { ...simulate(), refetch };
  },
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
      isPending: wagmi.isPending,
      reset: wagmi.resetWrite
    };
  }
}));

// Safe-connector hash workaround is irrelevant here (connector is undefined).
// The outcome hook reports only final outcomes (a success, or a revert / wallet
// cancel as `failure`); an RPC error while watching never reaches the engine.
// `receipt.error` / `failureReason` stand in for that final failure.
vi.mock('@/hooks/shared/useTransactionOutcome', () => ({
  useTransactionOutcome: () => ({
    isPending: wagmi.receipt.isLoading,
    isSuccess: wagmi.receipt.isSuccess,
    failure: wagmi.receipt.error ?? wagmi.receipt.failureReason,
    receipt: wagmi.receipt.data
  })
}));

vi.mock('@/hooks/shared/useWaitForSafeTxHash', () => ({
  useWaitForSafeTxHash: () => ({ transactionHash: undefined, isSafeApp: false })
}));

import { useSequentialTransactionFlow } from '@/hooks/shared/useSequentialTransactionFlow';
import { isStalledStep } from '@/hooks/helpers';

function makeCall(functionName: string): Call {
  return {
    to: '0x0000000000000000000000000000000000000001',
    abi: [],
    functionName,
    args: []
  } as unknown as Call;
}
const APPROVE = makeCall('approve');
const ACCOUNT_A = '0x00000000000000000000000000000000000000aA';
const ACCOUNT_B = '0x00000000000000000000000000000000000000bB';
const SUPPLY = makeCall('supply');

function resetWagmi() {
  wagmi.onMutate = undefined;
  wagmi.onWriteSuccess = undefined;
  wagmi.onWriteError = undefined;
  wagmi.writeContract = vi.fn();
  wagmi.resetWrite = vi.fn();
  wagmi.address = ACCOUNT_A;
  wagmi.simulationErrors = {};
  wagmi.refetchGate = undefined;
  wagmi.mutationHash = undefined;
  wagmi.isPending = false;
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
    // visible to the receipt hook on the next render.
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

    // Supply receipt mines → the final completion, carrying its block for the history refresh.
    act(() => {
      wagmi.receipt = {
        isLoading: false,
        isSuccess: true,
        error: null,
        failureReason: null,
        data: { blockNumber: 42n }
      };
    });
    rerender();

    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledWith('0xsupply', 42n);
    expect(onError).not.toHaveBeenCalled();
  });

  it('simulates and sends a payable call with its ETH, after an approve that carries none', () => {
    const deposit = { ...makeCall('deposit'), value: 7n } as Call;
    const { result, rerender } = renderHook(() =>
      useSequentialTransactionFlow({ calls: [APPROVE, deposit] })
    );

    act(() => result.current.execute());
    expect(wagmi.writeContract).toHaveBeenLastCalledWith(
      expect.objectContaining({ functionName: 'approve', value: undefined })
    );
    act(() => {
      wagmi.mutationHash = '0xapprove';
      wagmi.onWriteSuccess?.('0xapprove');
    });
    rerender();
    act(() => {
      wagmi.receipt = { isLoading: false, isSuccess: true, error: null, failureReason: null };
    });
    rerender();
    expect(wagmi.writeContract).toHaveBeenCalledTimes(2);
    expect(wagmi.writeContract).toHaveBeenLastCalledWith(
      expect.objectContaining({ functionName: 'deposit', value: 7n })
    );
  });

  it("simulates and sends a call with its explicit gas instead of the wallet's estimate", () => {
    const relay = { ...makeCall('relayMessage'), gas: 712_090n };
    const { result } = renderHook(() => useSequentialTransactionFlow({ calls: [relay] }));

    act(() => result.current.execute());
    expect(wagmi.writeContract).toHaveBeenLastCalledWith(
      expect.objectContaining({ functionName: 'relayMessage', gas: 712_090n })
    );
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
    expect(onSuccess).toHaveBeenCalledWith('0xsupply', undefined);
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
    expect(onSuccess).toHaveBeenCalledWith('0xsupply', undefined);
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
    expect(onSuccess).toHaveBeenLastCalledWith('0xsupply2', undefined);
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

// APP-448 — what a confirm after a wallet rejection executes. The engine
// rebuilds `calls` from the live form; a stand-in call name plays the part of
// "same call, edited args".
describe('useSequentialTransactionFlow — retry after a wallet rejection (APP-448)', () => {
  beforeEach(resetWagmi);
  afterEach(() => vi.clearAllMocks());

  const lastDispatchedCall = () =>
    (wagmi.writeContract.mock.calls.at(-1)?.[0] as { functionName?: string } | undefined)?.functionName;

  const mineApproveAndBroadcastSupply = (flow: { execute: () => void }, rerender: () => void) => {
    act(() => flow.execute());
    act(() => {
      wagmi.mutationHash = '0xapprove';
      wagmi.onWriteSuccess?.('0xapprove');
    });
    rerender();
    act(() => {
      wagmi.receipt = { isLoading: false, isSuccess: true, error: null, failureReason: null };
    });
    rerender();
    act(() => {
      wagmi.receipt = { isLoading: false, isSuccess: false, error: null, failureReason: null };
      wagmi.mutationHash = '0xsupply';
      wagmi.onWriteSuccess?.('0xsupply');
    });
    rerender();
  };

  it('a rejection of the FIRST call drops the snapshot: the next confirm dispatches the rebuilt call', () => {
    let calls: Call[] = [SUPPLY];
    const { result, rerender } = renderHook(() => useSequentialTransactionFlow({ calls }));

    act(() => result.current.execute());
    expect(lastDispatchedCall()).toBe('supply');

    // The wallet rejects the only call — nothing mined.
    act(() => {
      wagmi.mutationHash = undefined;
      wagmi.onWriteError?.(new Error('User rejected the request'));
    });
    // Back, edit the amount: the engine rebuilds the call.
    calls = [makeCall('supply-edited')];
    rerender();

    act(() => result.current.execute());
    expect(wagmi.writeContract).toHaveBeenCalledTimes(2);
    expect(lastDispatchedCall()).toBe('supply-edited');
    expect(result.current.currentCallIndex).toBe(0);
  });

  it('a rejection AFTER a mined step keeps the snapshot: the retry dispatches the frozen call, not a rebuilt one', () => {
    let calls: Call[] = [APPROVE, SUPPLY];
    const { result, rerender } = renderHook(() => useSequentialTransactionFlow({ calls }));

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
    expect(lastDispatchedCall()).toBe('supply');

    // The wallet rejects the supply; the live calls have moved on (allowance
    // landed, and a rebuild would carry whatever the form says now).
    act(() => {
      wagmi.mutationHash = undefined;
      wagmi.onWriteError?.(new Error('User rejected the request'));
    });
    calls = [makeCall('supply-edited')];
    rerender();

    // Try again resumes the paused run — the mined approve is its only memory.
    act(() => result.current.execute());
    expect(wagmi.writeContract).toHaveBeenCalledTimes(3);
    expect(lastDispatchedCall()).toBe('supply');
    expect(result.current.currentCallIndex).toBe(1);
  });

  it('a retry after a rejection AFTER a mined step sends nothing once the caller disabled the engine, and reports it', () => {
    const onError = vi.fn();
    const gate = { enabled: true };
    const { result, rerender } = renderHook(() =>
      useSequentialTransactionFlow({ calls: [APPROVE, SUPPLY], onError, enabled: gate.enabled })
    );

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
    act(() => {
      wagmi.mutationHash = undefined;
      wagmi.onWriteError?.(new Error('User rejected the request'));
    });
    gate.enabled = false;
    rerender();
    onError.mockClear();

    act(() => result.current.execute());
    expect(wagmi.writeContract).toHaveBeenCalledTimes(2);
    expect(onError).toHaveBeenCalledWith(new Error('The transaction can no longer be sent'), '');
  });

  it('an on-chain revert AFTER a mined step keeps the snapshot too: nextCalls holds the call and the retry re-simulates and dispatches it', async () => {
    const onError = vi.fn();
    const onSuccess = vi.fn();
    let calls: Call[] = [APPROVE, SUPPLY];
    const { result, rerender } = renderHook(() =>
      useSequentialTransactionFlow({ calls, onError, onSuccess })
    );

    mineApproveAndBroadcastSupply(result.current, rerender);
    expect(result.current.currentCallIndex).toBe(1);

    // The supply reverts on-chain.
    act(() => {
      wagmi.receipt = {
        isLoading: false,
        isSuccess: false,
        error: null,
        failureReason: new Error('execution reverted')
      };
    });
    rerender();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(result.current.isLoading).toBe(false);

    // The allowance refetch drops the mined approve from the live calls.
    calls = [SUPPLY];
    rerender();
    expect(result.current.nextCalls.map(c => c.functionName)).toEqual(['supply']);

    await act(async () => result.current.execute());
    expect(wagmi.writeContract).toHaveBeenCalledTimes(3);
    expect(lastDispatchedCall()).toBe('supply');

    act(() => {
      wagmi.receipt = { isLoading: false, isSuccess: false, error: null, failureReason: null };
      wagmi.mutationHash = '0xsupply2';
      wagmi.onWriteSuccess?.('0xsupply2');
    });
    rerender();
    act(() => {
      wagmi.receipt = { isLoading: false, isSuccess: true, error: null, failureReason: null };
    });
    rerender();
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(result.current.currentCallIndex).toBe(0);
  });
});

describe('useSequentialTransactionFlow — Retry after an on-chain revert', () => {
  beforeEach(resetWagmi);
  afterEach(() => vi.clearAllMocks());

  function renderRevertedSupply(gate = { enabled: true }) {
    const onError = vi.fn();
    const hook = renderHook(() =>
      useSequentialTransactionFlow({ calls: [APPROVE, SUPPLY], onError, enabled: gate.enabled })
    );
    act(() => hook.result.current.execute());
    act(() => {
      wagmi.mutationHash = '0xapprove';
      wagmi.onWriteSuccess?.('0xapprove');
    });
    hook.rerender();
    act(() => {
      wagmi.receipt = { isLoading: false, isSuccess: true, error: null, failureReason: null };
    });
    hook.rerender();
    act(() => {
      wagmi.receipt = { isLoading: false, isSuccess: false, error: null, failureReason: null };
      wagmi.mutationHash = '0xsupply';
      wagmi.onWriteSuccess?.('0xsupply');
    });
    hook.rerender();
    act(() => {
      wagmi.receipt = {
        isLoading: false,
        isSuccess: false,
        error: null,
        failureReason: new Error('execution reverted')
      };
    });
    hook.rerender();
    expect(onError).toHaveBeenCalledTimes(1);
    return { ...hook, onError };
  }

  it('sends nothing when the re-simulation still fails, and reports it', async () => {
    const { result, onError } = renderRevertedSupply();

    wagmi.simulationErrors = { supply: new Error('execution reverted') };
    await act(async () => result.current.execute());

    expect(wagmi.writeContract).toHaveBeenCalledTimes(2); // approve + the reverted supply
    expect(onError).toHaveBeenCalledTimes(2);
  });

  // A refetch runs even while the query is disabled, so the caller's gate (the
  // USDC supply's PSM fee gate) would otherwise be skipped.
  it('sends nothing when the caller disabled the engine since the revert, and reports it', async () => {
    const gate = { enabled: true };
    const { result, rerender, onError } = renderRevertedSupply(gate);

    gate.enabled = false;
    rerender();
    await act(async () => result.current.execute());

    expect(wagmi.writeContract).toHaveBeenCalledTimes(2);
    expect(onError).toHaveBeenCalledTimes(2);
  });

  it('sends nothing when the caller disables the engine while the re-simulation is in flight', async () => {
    const gate = { enabled: true };
    const { result, rerender, onError } = renderRevertedSupply(gate);

    act(() => result.current.execute());
    gate.enabled = false;
    rerender();
    await act(async () => {});

    expect(wagmi.writeContract).toHaveBeenCalledTimes(2);
    expect(onError).toHaveBeenCalledTimes(2);
  });

  it('a double-clicked Retry re-simulates and sends once', async () => {
    const { result } = renderRevertedSupply();

    await act(async () => {
      result.current.execute();
      result.current.execute();
    });

    expect(wagmi.writeContract).toHaveBeenCalledTimes(3);
  });

  it('a Retry still re-simulating when the run resets sends nothing', async () => {
    const { result } = renderRevertedSupply();

    await act(async () => {
      result.current.execute();
      result.current.reset();
    });

    expect(wagmi.writeContract).toHaveBeenCalledTimes(2);
  });
});

describe('useSequentialTransactionFlow — the wallet switches accounts mid-run', () => {
  beforeEach(resetWagmi);
  afterEach(() => vi.clearAllMocks());

  function mineApprove(hook: { rerender: () => void }) {
    act(() => {
      wagmi.mutationHash = '0xapprove';
      wagmi.onWriteSuccess?.('0xapprove');
    });
    hook.rerender();
    act(() => {
      wagmi.receipt = { isLoading: false, isSuccess: true, error: null, failureReason: null };
    });
    hook.rerender();
  }

  // The frozen supply can name account A (its receiver), so B must not sign it.
  it('pauses instead of sending the next step from the new account, and Retry sends it once back on the starting one', () => {
    const onError = vi.fn();
    const hook = renderHook(() => useSequentialTransactionFlow({ calls: [APPROVE, SUPPLY], onError }));

    act(() => hook.result.current.execute());
    wagmi.address = ACCOUNT_B;
    mineApprove(hook);

    expect(hook.result.current.currentCallIndex).toBe(1);
    expect(wagmi.writeContract).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(isStalledStep(onError.mock.calls[0][0])).toBe(true);
    expect(hook.result.current.isLoading).toBe(false);

    // Back on A, nothing is sent behind the error screen until the user retries.
    wagmi.address = ACCOUNT_A.toLowerCase();
    hook.rerender();
    expect(wagmi.writeContract).toHaveBeenCalledTimes(1);

    act(() => hook.result.current.execute());
    expect(wagmi.writeContract).toHaveBeenCalledTimes(2);
    expect(wagmi.writeContract).toHaveBeenLastCalledWith(expect.objectContaining({ functionName: 'supply' }));
  });

  it('a Retry re-simulating a reverted step sends nothing when the account switches before it lands', async () => {
    const onError = vi.fn();
    const hook = renderHook(() => useSequentialTransactionFlow({ calls: [APPROVE, SUPPLY], onError }));
    act(() => hook.result.current.execute());
    mineApprove(hook);
    act(() => {
      wagmi.receipt = { isLoading: false, isSuccess: false, error: null, failureReason: null };
      wagmi.mutationHash = '0xsupply';
      wagmi.onWriteSuccess?.('0xsupply');
    });
    hook.rerender();
    act(() => {
      wagmi.receipt = {
        isLoading: false,
        isSuccess: false,
        error: null,
        failureReason: new Error('execution reverted')
      };
    });
    hook.rerender();
    expect(onError).toHaveBeenCalledTimes(1);

    let release = () => {};
    wagmi.refetchGate = new Promise<void>(resolve => (release = resolve));
    act(() => hook.result.current.execute());
    wagmi.address = ACCOUNT_B;
    hook.rerender();
    await act(async () => release());

    expect(wagmi.writeContract).toHaveBeenCalledTimes(2); // approve + the reverted supply
    expect(onError).toHaveBeenCalledTimes(2);
    expect(onError.mock.calls[1][0].message).toMatch(/switched accounts/);
  });
});

describe('useSequentialTransactionFlow — a later step that fails to simulate', () => {
  beforeEach(resetWagmi);
  afterEach(() => vi.clearAllMocks());

  it('reports the failure instead of hanging, and only Retry sends the step once it simulates again', async () => {
    const onError = vi.fn();
    const calls: Call[] = [APPROVE, SUPPLY];
    const { result, rerender } = renderHook(() => useSequentialTransactionFlow({ calls, onError }));

    act(() => result.current.execute());
    // The supply stops simulating while the approve mines.
    wagmi.simulationErrors = { supply: new Error('transferFrom reverted') };
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
    expect(wagmi.writeContract).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(wagmi.simulationErrors.supply, '');
    expect(isStalledStep(onError.mock.calls[0][0])).toBe(true);
    expect(result.current.isLoading).toBe(false);

    // Re-renders with the same failure don't report it again.
    rerender();
    expect(onError).toHaveBeenCalledTimes(1);

    // Retry re-simulates; while it still fails it reports again instead of hanging.
    await act(async () => result.current.execute());
    expect(onError).toHaveBeenCalledTimes(2);
    expect(wagmi.writeContract).toHaveBeenCalledTimes(1);

    // The simulation recovers: nothing is sent behind the error screen…
    wagmi.simulationErrors = {};
    rerender();
    expect(wagmi.writeContract).toHaveBeenCalledTimes(1);

    // …until the user retries.
    await act(async () => result.current.execute());
    expect(wagmi.writeContract).toHaveBeenCalledTimes(2);
    expect(wagmi.writeContract).toHaveBeenLastCalledWith(expect.objectContaining({ functionName: 'supply' }));
  });

  function renderStalledSupply(gate = { enabled: true }) {
    const onError = vi.fn();
    const hook = renderHook(() =>
      useSequentialTransactionFlow({ calls: [APPROVE, SUPPLY], onError, enabled: gate.enabled })
    );
    act(() => hook.result.current.execute());
    wagmi.simulationErrors = { supply: new Error('RPC unavailable') };
    act(() => {
      wagmi.mutationHash = '0xapprove';
      wagmi.onWriteSuccess?.('0xapprove');
    });
    hook.rerender();
    act(() => {
      wagmi.receipt = { isLoading: false, isSuccess: true, error: null, failureReason: null };
    });
    hook.rerender();
    expect(onError).toHaveBeenCalledTimes(1);
    return { ...hook, onError };
  }

  it('Retry of a stalled step sends nothing when the caller disables the engine mid re-simulation', async () => {
    const gate = { enabled: true };
    const { result, rerender, onError } = renderStalledSupply(gate);

    wagmi.simulationErrors = {};
    act(() => result.current.execute());
    gate.enabled = false;
    rerender();
    await act(async () => {});

    expect(wagmi.writeContract).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(2);
  });

  // A new run can reach the same step before the old re-simulation lands.
  it('drops a stalled-step re-simulation that lands after a reset, even once a new run reached that step', async () => {
    const { result, rerender } = renderStalledSupply();
    let release!: () => void;
    wagmi.refetchGate = new Promise(r => (release = r));
    wagmi.simulationErrors = {};

    act(() => result.current.execute());
    act(() => result.current.reset());

    // The new run: approve, then the supply auto-dispatches.
    wagmi.receipt = { isLoading: false, isSuccess: false, error: null, failureReason: null };
    rerender();
    act(() => result.current.execute());
    act(() => {
      wagmi.mutationHash = '0xapprove2';
      wagmi.onWriteSuccess?.('0xapprove2');
    });
    rerender();
    act(() => {
      wagmi.receipt = { isLoading: false, isSuccess: true, error: null, failureReason: null };
    });
    rerender();
    expect(wagmi.writeContract).toHaveBeenCalledTimes(3); // approve, approve, supply

    await act(async () => release());
    expect(wagmi.writeContract).toHaveBeenCalledTimes(3);
  });

  it('Retry of a stalled step sends nothing when the caller disabled the engine, and reports it', async () => {
    const onError = vi.fn();
    const gate = { enabled: true };
    const { result, rerender } = renderHook(() =>
      useSequentialTransactionFlow({ calls: [APPROVE, SUPPLY], onError, enabled: gate.enabled })
    );

    act(() => result.current.execute());
    wagmi.simulationErrors = { supply: new Error('RPC unavailable') };
    act(() => {
      wagmi.mutationHash = '0xapprove';
      wagmi.onWriteSuccess?.('0xapprove');
    });
    rerender();
    act(() => {
      wagmi.receipt = { isLoading: false, isSuccess: true, error: null, failureReason: null };
    });
    rerender();
    expect(onError).toHaveBeenCalledTimes(1);

    // A disabled query keeps its last result; only the refetch would recover it.
    gate.enabled = false;
    rerender();
    wagmi.simulationErrors = {};
    await act(async () => result.current.execute());

    expect(wagmi.writeContract).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(2);
  });

  it('Retry re-simulates a step whose stored failure is stale', async () => {
    const onError = vi.fn();
    const { result, rerender } = renderHook(() =>
      useSequentialTransactionFlow({ calls: [APPROVE, SUPPLY], onError })
    );

    act(() => result.current.execute());
    wagmi.simulationErrors = { supply: new Error('RPC unavailable') };
    act(() => {
      wagmi.mutationHash = '0xapprove';
      wagmi.onWriteSuccess?.('0xapprove');
    });
    rerender();
    act(() => {
      wagmi.receipt = { isLoading: false, isSuccess: true, error: null, failureReason: null };
    });
    rerender();
    expect(onError).toHaveBeenCalledTimes(1);

    // The RPC recovers without a re-render, so the hook still holds the old error.
    wagmi.simulationErrors = {};
    await act(async () => result.current.execute());

    expect(onError).toHaveBeenCalledTimes(1);
    expect(wagmi.writeContract).toHaveBeenCalledTimes(2);
    expect(wagmi.writeContract).toHaveBeenLastCalledWith(expect.objectContaining({ functionName: 'supply' }));
  });

  function renderStalledOnSupply() {
    const onError = vi.fn();
    const hook = renderHook(() => useSequentialTransactionFlow({ calls: [APPROVE, SUPPLY], onError }));
    act(() => hook.result.current.execute());
    wagmi.simulationErrors = { supply: new Error('reverted') };
    act(() => {
      wagmi.mutationHash = '0xapprove';
      wagmi.onWriteSuccess?.('0xapprove');
    });
    hook.rerender();
    act(() => {
      wagmi.receipt = { isLoading: false, isSuccess: true, error: null, failureReason: null };
    });
    hook.rerender();
    wagmi.simulationErrors = {};
    return { ...hook, onError };
  }

  it('a double-clicked Retry sends the step once', async () => {
    const { result } = renderStalledOnSupply();

    await act(async () => {
      result.current.execute();
      result.current.execute();
    });

    expect(wagmi.writeContract).toHaveBeenCalledTimes(2);
  });

  it('a Retry still re-simulating when the run resets sends nothing', async () => {
    const { result } = renderStalledOnSupply();

    await act(async () => {
      result.current.execute();
      result.current.reset();
    });

    expect(wagmi.writeContract).toHaveBeenCalledTimes(1);
  });

  it('a Retry still re-simulating when the hook unmounts sends nothing', async () => {
    const { result, unmount } = renderStalledOnSupply();

    await act(async () => {
      result.current.execute();
      unmount();
    });

    expect(wagmi.writeContract).toHaveBeenCalledTimes(1);
  });

  it('a run that recovered from a failed simulation does not block the next run', async () => {
    const onSuccess = vi.fn();
    const { result, rerender } = renderHook(() =>
      useSequentialTransactionFlow({ calls: [APPROVE, SUPPLY], onSuccess })
    );
    const mine = (hash: `0x${string}`) => {
      act(() => {
        wagmi.receipt = { isLoading: false, isSuccess: false, error: null, failureReason: null };
        wagmi.mutationHash = hash;
        wagmi.onWriteSuccess?.(hash);
      });
      rerender();
      act(() => {
        wagmi.receipt = { isLoading: false, isSuccess: true, error: null, failureReason: null };
      });
      rerender();
    };

    // Run 1: the supply fails to simulate, recovers, and is retried to completion.
    act(() => result.current.execute());
    wagmi.simulationErrors = { supply: new Error('reverted') };
    mine('0xapprove1');
    wagmi.simulationErrors = {};
    await act(async () => result.current.execute());
    mine('0xsupply1');
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(result.current.currentCallIndex).toBe(0);

    // Run 2 on the same mounted hook: the supply auto-sends after the approve.
    act(() => result.current.execute());
    mine('0xapprove2');
    expect(wagmi.writeContract).toHaveBeenCalledTimes(4);
    expect(wagmi.writeContract).toHaveBeenLastCalledWith(expect.objectContaining({ functionName: 'supply' }));
  });

  it('a failing simulation on the first step is left to the confirm gate', () => {
    const onError = vi.fn();
    wagmi.simulationErrors = { approve: new Error('reverted') };
    renderHook(() => useSequentialTransactionFlow({ calls: [APPROVE, SUPPLY], onError }));
    expect(onError).not.toHaveBeenCalled();
  });
});

describe('useSequentialTransactionFlow — reset while a write is out (the modal closed mid-run)', () => {
  beforeEach(resetWagmi);
  afterEach(() => vi.clearAllMocks());

  const lastDispatchedCall = () =>
    (wagmi.writeContract.mock.calls.at(-1)?.[0] as { functionName?: string } | undefined)?.functionName;

  it('clears straight away when nothing is out', () => {
    const onCleared = vi.fn();
    const { result } = renderHook(() => useSequentialTransactionFlow({ calls: [SUPPLY] }));
    act(() => result.current.reset(onCleared));
    expect(wagmi.resetWrite).toHaveBeenCalledTimes(1);
    expect(onCleared).toHaveBeenCalledTimes(1);
  });

  it('lets a single call signed after the close mine and report success, then clears', () => {
    const onSuccess = vi.fn();
    const onCleared = vi.fn();
    const { result, rerender } = renderHook(() =>
      useSequentialTransactionFlow({ calls: [SUPPLY], onSuccess })
    );

    act(() => result.current.execute());
    act(() => {
      wagmi.isPending = true;
    });
    rerender();
    act(() => result.current.reset(onCleared));
    expect(wagmi.resetWrite).not.toHaveBeenCalled();
    expect(onCleared).not.toHaveBeenCalled();

    act(() => {
      wagmi.isPending = false;
      wagmi.mutationHash = '0xsupply';
      wagmi.onWriteSuccess?.('0xsupply');
    });
    rerender();
    act(() => {
      wagmi.receipt = { isLoading: false, isSuccess: true, error: null, failureReason: null };
    });
    rerender();

    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(wagmi.resetWrite).toHaveBeenCalledTimes(1);
    expect(onCleared).toHaveBeenCalledTimes(1);
  });

  it('sends nothing after an approve that mines after the close, and clears once it has', () => {
    const onSuccess = vi.fn();
    const onCleared = vi.fn();
    const { result, rerender } = renderHook(() =>
      useSequentialTransactionFlow({ calls: [APPROVE, SUPPLY], onSuccess })
    );

    act(() => result.current.execute());
    act(() => wagmi.onWriteSuccess?.('0xapprove'));
    // Mock state is read during render, so a real re-render must carry it
    // (a bailed-out one drops its effects).
    wagmi.mutationHash = '0xapprove';
    wagmi.receipt = { isLoading: true, isSuccess: false, error: null, failureReason: null };
    rerender();
    act(() => result.current.reset(onCleared));
    expect(onCleared).not.toHaveBeenCalled();

    act(() => {
      wagmi.receipt = { isLoading: false, isSuccess: true, error: null, failureReason: null };
    });
    rerender();
    rerender();

    expect(wagmi.writeContract).toHaveBeenCalledTimes(1);
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onCleared).toHaveBeenCalledTimes(1);
    expect(result.current.currentCallIndex).toBe(0);
  });

  it('stays loading while a prompt the close left open is unanswered, so no second write can overlap it', () => {
    const onCleared = vi.fn();
    const { result, rerender } = renderHook(() => useSequentialTransactionFlow({ calls: [SUPPLY] }));

    act(() => result.current.execute());
    wagmi.isPending = true;
    rerender();
    act(() => result.current.reset(onCleared));

    expect(result.current.isLoading).toBe(true);
    expect(wagmi.resetWrite).not.toHaveBeenCalled();
    expect(onCleared).not.toHaveBeenCalled();
  });

  it('a later step rejected after the close clears the run: the next confirm starts over from the live calls', () => {
    const onCleared = vi.fn();
    let calls: Call[] = [APPROVE, SUPPLY];
    const { result, rerender } = renderHook(() => useSequentialTransactionFlow({ calls }));

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
    expect(lastDispatchedCall()).toBe('supply');
    act(() => {
      wagmi.isPending = true;
    });
    rerender();

    act(() => result.current.reset(onCleared));
    act(() => {
      wagmi.isPending = false;
      wagmi.mutationHash = undefined;
      wagmi.onWriteError?.(new Error('User rejected the request'));
    });
    calls = [makeCall('supply-edited')];
    rerender();
    expect(onCleared).toHaveBeenCalledTimes(1);
    expect(result.current.currentCallIndex).toBe(0);

    act(() => result.current.execute());
    expect(lastDispatchedCall()).toBe('supply-edited');
  });
});
