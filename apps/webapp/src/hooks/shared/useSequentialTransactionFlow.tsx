import { useSimulateContract, useWaitForTransactionReceipt, useWriteContract } from 'wagmi';
import { isRevertedError, markStalledStep, toError } from '../helpers';
import { useEffect, useEffectEvent, useMemo, useState, useRef, useCallback } from 'react';
import { useWaitForSafeTxHash } from './useWaitForSafeTxHash';
import { SequentialTransactionHook, UseSequentialTransactionFlowParameters } from '../hooks';

// A refetch runs even while the query is disabled, so a Retry that re-simulates
// checks the caller's `enabled` gate itself, at the click and again when the
// result lands.
const notSendable = () => new Error('The transaction can no longer be sent');
const resimulationFailure = (error: Error | null) =>
  error ? toError(error) : new Error('The simulation returned no request');

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
    chainId
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
  // The step whose send reverted on-chain, and a Retry's in-flight re-simulation
  // (a token, so a reset or unmount drops a result that settles afterwards).
  const revertedIndexRef = useRef(-1);
  const resimulationRef = useRef<object | null>(null);
  const enabledRef = useRef(enabled);
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  // Use the stored transactions during execution
  const stableTransactions = isExecuting ? frozenCalls : calls;

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

  const {
    writeContract,
    error: writeError,
    data: mutationHash,
    reset: resetWrite
  } = useWriteContract({
    mutation: {
      onMutate,
      onSuccess: (hash: `0x${string}`) => {
        setHasFailed(false);
        onStart(hash);
      },
      onError: (err: Error) => {
        setHasFailed(true);
        // Nothing has mined after a first-call rejection, so there is nothing to
        // resume — and a snapshot kept here would have the next confirm sign the
        // pre-rejection call after the user went back and edited it (APP-448).
        if (currentIndex === 0) setIsExecuting(false);
        onError(err, mutationHash || '');
      }
    }
  });

  // Workaround to get `txHash` from Safe connector
  const { transactionHash: eventHash, isSafeApp: isSafeConnector } = useWaitForSafeTxHash({
    chainId: chainId,
    safeTxHash: mutationHash
  });

  const txHash = useMemo(
    () => (isSafeConnector ? eventHash : mutationHash),
    [eventHash, mutationHash, isSafeConnector]
  );

  // Monitor current transaction
  const {
    isLoading: isMining,
    isSuccess,
    error: miningError,
    failureReason,
    data: receipt
  } = useWaitForTransactionReceipt({
    hash: txHash
  });

  const txReverted = isRevertedError(failureReason);

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
      !transactionHashes[currentIndex] // Only execute if not already executed
    ) {
      dispatchedIndexRef.current = currentIndex;
      writeContract(simulationData.request as Parameters<typeof writeContract>[0]);
    }
  }, [currentIndex, prepared, simulationData, stableTransactions.length, transactionHashes, writeContract]);

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

  // Handle transaction completion
  useEffect(() => {
    // Only process if we're executing
    if (!isExecuting) return;

    if (txHash && isSuccess && !txReverted && lastProcessedTxHash.current !== txHash) {
      lastProcessedTxHash.current = txHash;

      const newHashes = [...transactionHashes];
      newHashes[currentIndex] = txHash;
      setTransactionHashes(newHashes);

      // Done only when every expected call has produced a hash, not merely when the index reaches the count.
      if (newHashes.filter(Boolean).length >= totalCallsRef.current) {
        // All transactions completed
        emitSuccess(txHash, receipt?.blockNumber);
        setIsExecuting(false);
        setCurrentIndex(0);
        setTransactionHashes([]);
        lastProcessedTxHash.current = undefined; // Reset ref on completion
        dispatchedIndexRef.current = -1; // next flow starts from a clean latch
        reportedSimulationIndexRef.current = -1;
        revertedIndexRef.current = -1;
      } else {
        // Move to next transaction - it will auto-execute once prepared
        setCurrentIndex(currentIndex + 1);
      }
    } else if (
      txHash &&
      (miningError || (failureReason && txReverted)) &&
      lastProcessedTxHash.current !== txHash
    ) {
      lastProcessedTxHash.current = txHash;
      // Transaction failed
      emitError(toError(miningError || failureReason), txHash);
      // Like a wallet rejection (see the write's onError), a revert after a mined
      // step keeps the run paused so Retry resumes the frozen remainder: the live
      // `calls` has dropped the mined approve, so slicing it at currentIndex would
      // come up empty and leave nothing to retry. Only a revert: any other receipt
      // error (an RPC failing to poll) can leave the tx pending, and resuming
      // would sign it a second time.
      const paused = currentIndex > 0 && txReverted;
      if (paused) revertedIndexRef.current = currentIndex;
      setIsExecuting(paused);
      setHasFailed(paused);
    }
  }, [
    isExecuting,
    isSuccess,
    miningError,
    failureReason,
    txHash,
    txReverted,
    receipt?.blockNumber,
    currentIndex,
    transactionHashes
  ]);

  const reset = useCallback(() => {
    setIsExecuting(false);
    setCurrentIndex(0);
    setTransactionHashes([]);
    setHasFailed(false);
    dispatchedIndexRef.current = -1;
    reportedSimulationIndexRef.current = -1;
    revertedIndexRef.current = -1;
    resimulationRef.current = null;
    resetWrite();
    // Do NOT clear lastProcessedTxHash — it guards against
    // stale hash being replayed during multi-step execution
  }, [resetWrite]);

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
        const request = live && !error ? data?.request : undefined;
        if (request) {
          onSent?.();
          writeContract(request as Parameters<typeof writeContract>[0]);
        } else {
          onFailed?.();
          onError(live ? resimulationFailure(error) : notSendable(), '');
        }
      });
    };

    if (isResume && revertedIndexRef.current === currentIndex) {
      // Retry of a step that reverted on-chain: the held simulation predates the
      // revert, so re-simulate rather than re-send what just failed. The index
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
    isLoading: isSimulationLoading || (isMining && !txReverted) || (isExecuting && !hasFailed),
    prepared,
    error: writeError || miningError || simulationError,
    currentCallIndex: currentIndex,
    reset
  };
}
