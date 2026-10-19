import { useConnection, useSimulateContract, useWriteContract } from 'wagmi';
import { markStalledStep, toError } from '../helpers';
import { useEffect, useEffectEvent, useMemo, useState, useRef, useCallback } from 'react';
import { useWaitForSafeTxHash } from './useWaitForSafeTxHash';
import { useTransactionOutcome } from './useTransactionOutcome';
import {
  SequentialTransactionHook,
  TxMutateVariables,
  UseSequentialTransactionFlowParameters
} from '../hooks';

// A refetch runs even while the query is disabled, so a Retry that re-simulates
// checks the caller's `enabled` gate itself, at the click and again when the
// result lands.
const notSendable = () => new Error('The transaction can no longer be sent');
const resimulationFailure = (error: Error | null) =>
  error ? toError(error) : new Error('The simulation returned no request');
const accountSwitched = () => new Error('The wallet switched accounts during the run');

export function useSequentialTransactionFlow(
  parameters: UseSequentialTransactionFlowParameters
): SequentialTransactionHook {
  const {
    calls,
    enabled = true,
    onMutate = () => null,
    onStart = () => null,
    onSuccess = () => null,
    onError = () => null,
    gcTime = 30000,
    chainId,
    failOnReplaced = false
  } = parameters;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [transactionHashes, setTransactionHashes] = useState<string[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  // The current call failed, in the wallet or on-chain: ends the loading state while a
  // paused run (isExecuting held after a mined step) waits for Retry.
  const [hasFailed, setHasFailed] = useState(false);

  // Snapshot of `calls` frozen at execute() time — keeps a refetching quote
  // from swapping in different args after the user clicked Confirm.
  const [frozenCalls, setFrozenCalls] = useState(calls);
  // Frozen call count for the completion check; the live `calls` length shrinks after an approve.
  const totalCallsRef = useRef(0);
  // The call index most recently handed to the wallet. `transactionHashes[i]` cannot
  // serve as the "already dispatched" guard because it is only filled once the tx
  // MINES — leaving the whole submit→mine window open to a re-dispatch every time
  // `useSimulateContract` hands back a new object (a refetch on window focus when the
  // user returns from the wallet, or a cache hit followed by a background refetch on a
  // repeat flow). That re-dispatch sent a second supply tx and double-advanced the
  // modal's step counter, completing the step before its tx mined (APP-417).
  const dispatchedIndexRef = useRef(-1);
  // The step index whose failed simulation was reported. That step waits for
  // Retry: a simulation that recovers on its own must not send it behind the
  // error screen.
  const reportedSimulationIndexRef = useRef(-1);
  // The step whose send reverted or was replaced in the wallet, and a Retry's in-flight re-simulation
  // (a token, so a reset or unmount drops a result that settles afterwards).
  const revertedIndexRef = useRef(-1);
  const resimulationRef = useRef<object | null>(null);
  // Set by a reset() that found a write out (the modal closed mid-run): that
  // write settles and reports, nothing after it is sent, then the run clears.
  // The run stays loading meanwhile, so no second write can overlap it: a
  // replaced write still fires the mutation's callbacks when it settles.
  const detachedRef = useRef<{ onCleared?: () => void } | null>(null);
  const finishDetachedRef = useRef(() => {});
  const enabledRef = useRef(enabled);
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);
  // The account that started the run. A later step is only sent from it: the
  // frozen calls can name the starting account (a deposit's receiver), so
  // another account signing them would pay into that account's position.
  const { address } = useConnection();
  const runAccountRef = useRef<string | undefined>(undefined);
  const addressRef = useRef(address);
  useEffect(() => {
    addressRef.current = address;
  }, [address]);
  const isRunAccount = (account: string | undefined) =>
    account?.toLowerCase() === runAccountRef.current?.toLowerCase();

  // Use the stored transactions during execution
  const stableTransactions = isExecuting ? frozenCalls : calls;

  // What execute() would send from here (see `BatchWriteHook.nextCalls`); memoized so
  // consumers keyed on it don't re-run every render.
  const nextCalls = useMemo(() => stableTransactions.slice(currentIndex), [stableTransactions, currentIndex]);

  // Get current transaction with memoization
  const currentTransaction = useMemo(
    () => stableTransactions[currentIndex],
    [stableTransactions, currentIndex]
  );

  // Memoize simulation parameters to prevent unnecessary re-renders
  const simulationParams = useMemo(
    () => ({
      address: currentTransaction?.to,
      abi: currentTransaction?.abi,
      functionName: currentTransaction?.functionName,
      args: currentTransaction?.args,
      // A payable call's ETH; dropped here, the wallet would send none.
      value: currentTransaction?.value,
      gas: currentTransaction?.gas,
      query: {
        // Only enable simulation for the first transaction initially, or for subsequent transactions after previous success
        enabled:
          enabled &&
          currentIndex < stableTransactions.length &&
          (currentIndex === 0 || (currentIndex > 0 && transactionHashes.length >= currentIndex)),
        gcTime
      }
    }),
    [currentTransaction, enabled, currentIndex, stableTransactions.length, transactionHashes.length, gcTime]
  );

  // Prepare current transaction
  const {
    data: simulationData,
    isLoading: isSimulationLoading,
    error: simulationError,
    refetch: refetchSimulation
  } = useSimulateContract(simulationParams as unknown as Parameters<typeof useSimulateContract>[0]);

  // The request of the latest wallet prompt. Each dispatch gets its own object, so the
  // variables wagmi passes back tell a prompt signed late from the one in flight.
  const latestRequestRef = useRef<object | undefined>(undefined);
  const isLatest = (variables?: object) => !variables || variables === latestRequestRef.current;
  const emitStart = (hash: string, variables?: TxMutateVariables) =>
    variables ? onStart(hash, variables) : onStart(hash);
  const {
    writeContract: writeContractMutation,
    error: writeError,
    data: mutationHash,
    variables: writeVariables,
    isPending: isWritePending,
    reset: resetWrite
  } = useWriteContract({
    mutation: {
      onMutate,
      onSuccess: (hash: `0x${string}`, variables) => {
        if (isLatest(variables)) setHasFailed(false);
        emitStart(hash, variables);
      },
      onError: (err: Error, variables) => {
        // An earlier prompt settling late must not stop the run in flight.
        if (isLatest(variables)) {
          setHasFailed(true);
          // Nothing has mined after a first-call rejection, so there is nothing to
          // resume — and a snapshot kept here would have the next confirm sign the
          // pre-rejection call after the user went back and edited it (APP-448).
          if (currentIndex === 0) setIsExecuting(false);
        }
        onError(err, mutationHash || '', variables);
        if (detachedRef.current) finishDetachedRef.current();
      }
    }
  });
  const writeContract = useCallback(
    (request: Parameters<typeof writeContractMutation>[0]) => {
      const fresh = { ...request };
      latestRequestRef.current = fresh;
      writeContractMutation(fresh);
    },
    [writeContractMutation]
  );

  // Workaround to get `txHash` from Safe connector
  const { transactionHash: eventHash, isSafeApp: isSafeConnector } = useWaitForSafeTxHash({
    chainId: chainId,
    safeTxHash: mutationHash
  });

  const txHash = useMemo(
    () => (isSafeConnector ? eventHash : mutationHash),
    [eventHash, mutationHash, isSafeConnector]
  );

  // With failOnReplaced, a repriced tx (same call, new fee) is reported under the hash that mines.
  const repricedRef = useRef<{ from: string; to: string } | undefined>(undefined);
  const minedHash = (hash: string) => (repricedRef.current?.from === hash ? repricedRef.current.to : hash);

  // Monitor current transaction
  const {
    isPending: isMining,
    isSuccess,
    failure: txFailure,
    receipt
  } = useTransactionOutcome({
    hash: txHash,
    chainId,
    onRepriced: failOnReplaced
      ? (from, to) => {
          repricedRef.current = { from, to };
          emitStart(to, writeVariables);
        }
      : undefined
  });

  // A write in the wallet, awaiting a Safe's co-signers, or mining.
  const writeOut = !!isWritePending || (!!mutationHash && !txHash) || (!!txHash && !isSuccess && !txFailure);
  const writeOutRef = useRef(writeOut);
  useEffect(() => {
    writeOutRef.current = writeOut;
  }, [writeOut]);

  // Check if current transaction is prepared
  const prepared = useMemo(() => {
    if (stableTransactions.length === 0) return false;
    return currentIndex < stableTransactions.length && !!simulationData?.request;
  }, [currentIndex, stableTransactions.length, simulationData?.request]);

  // Auto-execute next transaction when it's prepared (for subsequent transactions after first)
  useEffect(() => {
    if (
      currentIndex > 0 &&
      prepared &&
      simulationData?.request &&
      currentIndex < stableTransactions.length &&
      dispatchedIndexRef.current !== currentIndex && // one dispatch per index — see the ref
      reportedSimulationIndexRef.current !== currentIndex &&
      isRunAccount(address) && // see the account-switch pause below
      !transactionHashes[currentIndex] // Only execute if not already executed
    ) {
      dispatchedIndexRef.current = currentIndex;
      writeContract(simulationData.request as Parameters<typeof writeContract>[0]);
    }
  }, [
    currentIndex,
    prepared,
    simulationData,
    stableTransactions.length,
    transactionHashes,
    writeContract,
    address
  ]);

  const lastProcessedTxHash = useRef<string | undefined>(undefined);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      lastProcessedTxHash.current = undefined;
      dispatchedIndexRef.current = -1;
      revertedIndexRef.current = -1;
      resimulationRef.current = null;
    };
  }, []);

  // The consumer's callbacks are read through effect events: the completion
  // effect must not re-run because a caller passed a new inline function.
  const emitSuccess = useEffectEvent((hash: string, blockNumber?: bigint) => onSuccess(hash, blockNumber));
  const emitError = useEffectEvent((err: Error, hash: string) => onError(err, hash));

  // A later step is only sent once its simulation succeeds, so a step that
  // stops simulating after an earlier one mined (e.g. a repay whose debt
  // accrued past the approved amount) would otherwise leave the run executing
  // with nothing in flight. Report it once per step and pause like a wallet
  // rejection, so the modal fails with Retry instead of hanging on Processing.
  useEffect(() => {
    if (
      !isExecuting ||
      currentIndex === 0 ||
      !simulationError ||
      dispatchedIndexRef.current === currentIndex ||
      reportedSimulationIndexRef.current === currentIndex
    )
      return;
    reportedSimulationIndexRef.current = currentIndex;
    setHasFailed(true);
    emitError(markStalledStep(simulationError), '');
  }, [isExecuting, currentIndex, simulationError]);

  // The wallet moved to another account after a step mined. Pause like a
  // stalled step, so Retry goes through the modal's dispatch checks, which
  // refuse it unless the wallet is back on the starting account.
  useEffect(() => {
    if (
      !isExecuting ||
      currentIndex === 0 ||
      isRunAccount(address) ||
      dispatchedIndexRef.current === currentIndex ||
      reportedSimulationIndexRef.current === currentIndex
    )
      return;
    reportedSimulationIndexRef.current = currentIndex;
    setHasFailed(true);
    emitError(markStalledStep(accountSwitched()), '');
  }, [isExecuting, currentIndex, address]);

  // Handle transaction completion
  useEffect(() => {
    // Only process if we're executing
    if (!isExecuting) return;

    if (txHash && isSuccess && lastProcessedTxHash.current !== txHash) {
      lastProcessedTxHash.current = txHash;

      const newHashes = [...transactionHashes];
      newHashes[currentIndex] = txHash;
      setTransactionHashes(newHashes);

      // Done only when every expected call has produced a hash, not merely when the index reaches the count.
      if (newHashes.filter(Boolean).length >= totalCallsRef.current) {
        // All transactions completed
        emitSuccess(minedHash(txHash), receipt?.blockNumber);
        setIsExecuting(false);
        setCurrentIndex(0);
        setTransactionHashes([]);
        lastProcessedTxHash.current = undefined; // Reset ref on completion
        dispatchedIndexRef.current = -1; // next flow starts from a clean latch
        reportedSimulationIndexRef.current = -1;
        revertedIndexRef.current = -1;
        if (detachedRef.current) finishDetachedRef.current();
      } else if (detachedRef.current) {
        finishDetachedRef.current();
      } else {
        // Move to next transaction - it will auto-execute once prepared
        setCurrentIndex(currentIndex + 1);
      }
    } else if (txHash && txFailure && lastProcessedTxHash.current !== txHash) {
      lastProcessedTxHash.current = txHash;
      // Transaction failed: reverted, or cancelled/replaced in the wallet. Never
      // an RPC error while watching — the outcome hook keeps watching through
      // those, since the tx may still land.
      emitError(txFailure, minedHash(txHash));
      // Like a wallet rejection (see the write's onError), a failure after a
      // mined step keeps the run paused so Retry resumes the frozen remainder:
      // the live `calls` has dropped the mined approve, so slicing it at
      // currentIndex would come up empty and leave nothing to retry.
      if (detachedRef.current) {
        finishDetachedRef.current();
        return;
      }
      const paused = currentIndex > 0;
      if (paused) revertedIndexRef.current = currentIndex;
      setIsExecuting(paused);
      setHasFailed(paused);
    }
  }, [isExecuting, isSuccess, txFailure, txHash, receipt?.blockNumber, currentIndex, transactionHashes]);

  const clearRun = useCallback(() => {
    detachedRef.current = null;
    setIsExecuting(false);
    setCurrentIndex(0);
    setTransactionHashes([]);
    setHasFailed(false);
    dispatchedIndexRef.current = -1;
    reportedSimulationIndexRef.current = -1;
    latestRequestRef.current = undefined;
    revertedIndexRef.current = -1;
    resimulationRef.current = null;
    resetWrite();
    // Do NOT clear lastProcessedTxHash — it guards against
    // stale hash being replayed during multi-step execution
  }, [resetWrite]);

  useEffect(() => {
    finishDetachedRef.current = () => {
      const onCleared = detachedRef.current?.onCleared;
      clearRun();
      onCleared?.();
    };
  }, [clearRun]);

  const reset = useCallback(
    (onCleared?: () => void) => {
      if (writeOutRef.current) {
        detachedRef.current = { onCleared };
        return;
      }
      clearRun();
      onCleared?.();
    },
    [clearRun]
  );

  // Memoize execute function to prevent recreation on every render
  const execute = useCallback(() => {
    // Retrying a call the wallet rejected re-enters mid-sequence (currentIndex > 0)
    // while the live `calls` has already shrunk — the approve drops out of the array
    // as soon as its allowance lands. Bounds-check against the sequence frozen at the
    // start of this run instead, or the retry is silently swallowed here.
    const isResume = isExecuting && currentIndex > 0;
    const sequence = isResume ? frozenCalls : calls;

    if (currentIndex >= sequence.length) {
      console.error('ERROR: All transactions have been executed');
      return;
    }

    if (!currentTransaction) {
      console.error('ERROR: No current transaction to execute');
      return;
    }

    // A Retry that re-simulates before sending. The token is the in-flight
    // latch, so a second click is a no-op and a reset or unmount (which clears
    // it) drops a result that lands afterwards, even if a new run has reached
    // the same step. A failed refetch keeps the last good `data`, so only a
    // refetch without an error may send.
    const resimulateAndSend = ({ onSent, onFailed }: { onSent?: () => void; onFailed?: () => void }) => {
      if (resimulationRef.current) return;
      if (!enabled) {
        onError(notSendable(), '');
        return;
      }
      const token = {};
      resimulationRef.current = token;
      void refetchSimulation().then(({ data, error }) => {
        if (resimulationRef.current !== token) return;
        resimulationRef.current = null;
        const live = enabledRef.current;
        const sameAccount = isRunAccount(addressRef.current);
        const request = live && sameAccount && !error ? data?.request : undefined;
        if (request) {
          onSent?.();
          writeContract(request as Parameters<typeof writeContract>[0]);
        } else {
          onFailed?.();
          onError(!live ? notSendable() : !sameAccount ? accountSwitched() : resimulationFailure(error), '');
        }
      });
    };

    if (isResume && revertedIndexRef.current === currentIndex) {
      // Retry of a step that reverted or was replaced: the held simulation
      // predates the failure, so re-simulate rather than re-send what just failed. The index
      // stays claimed, so the auto-execute effect doesn't fire meanwhile.
      resimulateAndSend({
        onSent: () => {
          revertedIndexRef.current = -1;
        }
      });
    } else if (simulationData?.request) {
      // The held request outlives the gate: a Retry after a wallet rejection
      // must not send it once `enabled` has gone false.
      if (isResume && !enabled) {
        onError(notSendable(), '');
        return;
      }
      if (!isResume) {
        setFrozenCalls(calls); // freeze args for the whole sequence
        totalCallsRef.current = calls.length; // and the count, for the completion check
        runAccountRef.current = addressRef.current;
      }
      // This call is dispatched here, so claim its index before the auto-execute
      // effect can see it (a retry re-enters at a non-zero currentIndex).
      dispatchedIndexRef.current = currentIndex;
      setIsExecuting(true);
      writeContract(simulationData.request as Parameters<typeof writeContract>[0]);
    } else if (isResume && simulationError) {
      // Retry of a step that failed to simulate: the stored error may be stale
      // (e.g. a transient RPC failure), so re-simulate and act on the result.
      // Claiming the index keeps the auto-execute effect from sending it
      // meanwhile; a failure releases it for the next Retry.
      if (dispatchedIndexRef.current === currentIndex) return;
      const index = currentIndex;
      resimulateAndSend({
        onFailed: () => {
          if (dispatchedIndexRef.current === index) dispatchedIndexRef.current = -1;
        }
      });
      if (resimulationRef.current) dispatchedIndexRef.current = index;
    } else {
      console.error(`ERROR: Transaction ${currentIndex} is not ready to execute.
      contract address: ${currentTransaction.to}
      function name: ${currentTransaction.functionName}
      function arguments: ${currentTransaction.args}
      isSimulationLoading: ${isSimulationLoading}
      simulationError: ${simulationError}
      enabled: ${enabled}`);
    }
  }, [
    enabled,
    currentIndex,
    isExecuting,
    calls,
    frozenCalls,
    currentTransaction,
    simulationData,
    writeContract,
    isSimulationLoading,
    simulationError,
    refetchSimulation,
    onError
  ]);

  return {
    execute,
    isLoading: isSimulationLoading || isMining || (isExecuting && !hasFailed),
    prepared,
    error: writeError || txFailure || simulationError,
    currentCallIndex: currentIndex,
    reset,
    nextCalls
  };
}
