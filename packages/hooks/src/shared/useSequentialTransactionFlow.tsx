import {
  UseSimulateContractParameters,
  useConnection,
  useSimulateContract,
  useWaitForTransactionReceipt,
  useWriteContract
} from 'wagmi';
import { isRevertedError } from '../helpers';
import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { SAFE_CONNECTOR_ID } from './constants';
import { useWaitForSafeTxHash } from './useWaitForSafeTxHash';
import { SequentialTransactionHook, UseSequentialTransactionFlowParameters } from '../hooks';

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

  // Store initial transactions to prevent issues with changing array references
  const transactionsRef = useRef(calls);

  // Only update the ref when execution starts
  useEffect(() => {
    if (isExecuting && currentIndex === 0) {
      transactionsRef.current = calls;
    }
  }, [isExecuting, currentIndex, calls]);

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
  } = useSimulateContract(simulationParams as UseSimulateContractParameters);

  const {
    writeContract,
    error: writeError,
    data: mutationHash
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
      !transactionHashes[currentIndex] // Only execute if not already executed
    ) {
      writeContract(simulationData.request);
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

      // Check if this was the last transaction
      const nextIndex = currentIndex + 1;

      if (nextIndex >= stableTransactions.length) {
        // All transactions completed
        onSuccess(txHash);
        setIsExecuting(false);
        setCurrentIndex(0);
        setTransactionHashes([]);
        lastProcessedTxHash.current = undefined; // Reset ref on completion
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
      const error = miningError || failureReason;
      onError(error as Error, txHash);
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
    stableTransactions.length,
    transactionHashes
  ]);

  // Memoize execute function to prevent recreation on every render
  const execute = useCallback(() => {
    if (currentIndex >= stableTransactions.length) {
      console.log('ERROR: All transactions have been executed');
      return;
    }

    if (!currentTransaction) {
      console.log('ERROR: No current transaction to execute');
      return;
    }

    if (simulationData?.request) {
      setIsExecuting(true);
      writeContract(simulationData.request);
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
    stableTransactions.length,
    currentTransaction,
    simulationData,
    writeContract,
    isSimulationLoading,
    simulationError
  ]);

  return {
    execute,
    isLoading: isSimulationLoading || (isMining && !txReverted) || (isExecuting && !hasWriteError),
    prepared,
    error: writeError || miningError || simulationError
  };
}
