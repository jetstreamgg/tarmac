import {
  deepEqual,
  useConnection,
  useSimulateContract,
  useWaitForTransactionReceipt,
  useWriteContract
} from 'wagmi';
import { isRevertedError, toError } from '../helpers';
import { useContext, useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { SAFE_CONNECTOR_ID } from './constants';
import { useWaitForSafeTxHash } from './useWaitForSafeTxHash';
import { BackToEditContext } from './backToEditContext';
import { SequentialTransactionHook, UseSequentialTransactionFlowParameters } from '../hooks';

type SequentialCall = UseSequentialTransactionFlowParameters['calls'][number];

// Same target and args — the abi is deliberately ignored, it only affects encoding.
function sameCall(a: SequentialCall, b: SequentialCall): boolean {
  return (
    a.to === b.to && a.functionName === b.functionName && a.value === b.value && deepEqual(a.args, b.args)
  );
}

function sameSequence(a: readonly SequentialCall[], b: readonly SequentialCall[]): boolean {
  return a.length === b.length && a.every((call, i) => sameCall(call, b[i]));
}

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
  const [hasWriteError, setHasWriteError] = useState(false);

  // Snapshot of `calls` frozen at execute() time — keeps a refetching quote
  // from swapping in different args after the user clicked Confirm.
  const transactionsRef = useRef(calls);
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

  // Use the stored transactions during execution
  const stableTransactions = isExecuting ? transactionsRef.current : calls;

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
    error: simulationError
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
        setHasWriteError(false);
        onStart(hash);
      },
      onError: (err: Error) => {
        setHasWriteError(true);
        onError(err, mutationHash || '');
      }
    }
  });

  // Workaround to get `txHash` from Safe connector
  const { connector } = useConnection();
  const isSafeConnector = connector?.id === SAFE_CONNECTOR_ID;

  const eventHash = useWaitForSafeTxHash({
    chainId: chainId,
    safeTxHash: mutationHash,
    isSafeConnector
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
    failureReason
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
    };
  }, []);

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
        onSuccess(txHash);
        setIsExecuting(false);
        setCurrentIndex(0);
        setTransactionHashes([]);
        lastProcessedTxHash.current = undefined; // Reset ref on completion
        dispatchedIndexRef.current = -1; // next flow starts from a clean latch
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
      onError(toError(miningError || failureReason), txHash);
      setIsExecuting(false);
    }
  }, [
    isExecuting,
    isSuccess,
    miningError,
    failureReason,
    txHash,
    txReverted,
    currentIndex,
    transactionHashes
  ]);

  const reset = useCallback(() => {
    setIsExecuting(false);
    setCurrentIndex(0);
    setTransactionHashes([]);
    setHasWriteError(false);
    dispatchedIndexRef.current = -1;
    resetWrite();
    // Do NOT clear lastProcessedTxHash — it guards against
    // stale hash being replayed during multi-step execution
  }, [resetWrite]);

  // The modal bumps the epoch when the user backs out of the wallet/status
  // screen to the editable entry (see BackToEditContext); execute() stamps the
  // epoch it last dispatched under, so a mismatch means the user has gone Back
  // since this run touched the wallet. Only then may the run be dropped, and
  // only once the live calls actually diverge from the frozen snapshot
  // (APP-448) — an unchanged reconfirm must RESUME mid-sequence, or a mined
  // value-moving first call (PSM sellGem, upgrade) would be re-dispatched. The
  // frozen tail also counts as unchanged: the engine drops a mined approve
  // once its allowance lands. Without a Back, background args churn — a
  // refetching quote — never resets; a plain retry resumes the frozen args. A
  // run stranded mid-sequence by an on-chain revert (not executing, index > 0)
  // has nothing to resume, so there Back always clears it.
  const backToEditEpoch = useContext(BackToEditContext);
  const runEpochRef = useRef(backToEditEpoch);
  useEffect(() => {
    if (backToEditEpoch === runEpochRef.current) return;
    if (!isExecuting && currentIndex === 0) return;
    const frozen = transactionsRef.current;
    if (isExecuting && (sameSequence(calls, frozen) || sameSequence(calls, frozen.slice(currentIndex)))) {
      return;
    }
    reset();
  }, [backToEditEpoch, isExecuting, calls, currentIndex, reset]);

  // Memoize execute function to prevent recreation on every render
  const execute = useCallback(() => {
    // Retrying a call the wallet rejected re-enters mid-sequence (currentIndex > 0)
    // while the live `calls` has already shrunk — the approve drops out of the array
    // as soon as its allowance lands. Bounds-check against the sequence frozen at the
    // start of this run instead, or the retry is silently swallowed here.
    const isResume = isExecuting && currentIndex > 0;
    const sequence = isResume ? transactionsRef.current : calls;

    if (currentIndex >= sequence.length) {
      console.log('ERROR: All transactions have been executed');
      return;
    }

    if (!currentTransaction) {
      console.log('ERROR: No current transaction to execute');
      return;
    }

    if (simulationData?.request) {
      if (!isResume) {
        transactionsRef.current = calls; // freeze args for the whole sequence
        totalCallsRef.current = calls.length; // and the count, for the completion check
      }
      // Re-confirming consumes the Back signal: args churn after this dispatch
      // is background noise again, not an edit (see the epoch effect above).
      runEpochRef.current = backToEditEpoch;
      // This call is dispatched here, so claim its index before the auto-execute
      // effect can see it (a retry re-enters at a non-zero currentIndex).
      dispatchedIndexRef.current = currentIndex;
      setIsExecuting(true);
      writeContract(simulationData.request as Parameters<typeof writeContract>[0]);
    } else {
      console.log(`ERROR: Transaction ${currentIndex} is not ready to execute.
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
    currentTransaction,
    simulationData,
    writeContract,
    isSimulationLoading,
    simulationError,
    backToEditEpoch
  ]);

  return {
    execute,
    isLoading: isSimulationLoading || (isMining && !txReverted) || (isExecuting && !hasWriteError),
    prepared,
    error: writeError || miningError || simulationError,
    currentCallIndex: currentIndex,
    reset
  };
}
