import { BatchWriteHook, UseTransactionFlowParameters } from '../hooks';
import { useSequentialTransactionFlow } from './useSequentialTransactionFlow';
import { useSendBatchTransactionFlow } from './useSendBatchTransactionFlow';
import { useIsBatchSupported } from './useIsBatchSupported';

/**
 * A unified hook that routes to either sequential or batch transaction flow
 * based on the shouldUseBatch parameter and wallet capabilities.
 *
 * @param parameters Configuration for the transaction flow
 * @returns BatchWriteHook interface for executing transactions
 */
export function useTransactionFlow(parameters: UseTransactionFlowParameters): BatchWriteHook {
  const {
    calls,
    shouldUseBatch = true,
    enabled = true,
    onMutate,
    onStart,
    onSuccess,
    onError,
    gcTime,
    chainId
  } = parameters;

  // Check if wallet supports batch transactions
  const { data: batchSupported, isLoading: isLoadingCapabilities } = useIsBatchSupported();

  // Determine if we should actually use batch based on user preference, wallet support, and number of calls
  const useBatch = shouldUseBatch && batchSupported && calls.length > 1;

  const commonTransactionParameters = {
    calls,
    onMutate,
    onStart,
    onSuccess,
    onError,
    chainId
  };

  // Use sequential flow
  const sequentialResults = useSequentialTransactionFlow({
    ...commonTransactionParameters,
    enabled: enabled && !useBatch && !isLoadingCapabilities,
    gcTime
  });

  // Use batch flow
  const batchResults = useSendBatchTransactionFlow({
    ...commonTransactionParameters,
    enabled: enabled && useBatch && !isLoadingCapabilities
  });

  // Return the appropriate results based on useBatch
  return useBatch ? batchResults : sequentialResults;
}
