import { useSendCalls, useWaitForCallsStatus } from 'wagmi';
import { BatchWriteHook, UseSendBatchTransactionFlowParameters } from '../hooks';
import { useEffect } from 'react';
import { isRevertedError } from '../helpers';
import { Config } from '@wagmi/core';
import { useIsBatchSupported } from './useIsBatchSupported';

export function useSendBatchTransactionFlow<const calls extends readonly unknown[], config extends Config>(
  parameters: UseSendBatchTransactionFlowParameters<calls, config>
): BatchWriteHook {
  const {
    enabled,
    onMutate = () => null,
    onSuccess = () => null,
    onError = () => null,
    onStart = () => null,
    ...sendCallsParameters
  } = parameters;

  // Check if wallet supports batch transactions
  const {
    data: batchSupported,
    isLoading: isLoadingCapabilities,
    error: capabilitiesError
  } = useIsBatchSupported();

  // Initiate hook to send the batch transaction
  const {
    sendCalls,
    error: sendError,
    data: mutationData
  } = useSendCalls({
    mutation: {
      onMutate,
      onSuccess: () => {
        if (onStart) {
          onStart();
        }
      },
      onError: (err: Error) => {
        if (onError) {
          onError(err, mutationData?.id);
        }
      }
    }
  });

  // Monitor tx, this is also compatible with Safe wallets
  const {
    isLoading: isMining,
    isSuccess,
    error: miningError,
    failureReason,
    data
  } = useWaitForCallsStatus({
    id: mutationData?.id
  });

  const txReverted = isRevertedError(failureReason);

  useEffect(() => {
    if (mutationData?.id) {
      if (isSuccess && data.status === 'success') {
        onSuccess(data.receipts?.[0].transactionHash);
      } else if (isSuccess && data.status === 'failure') {
        onError(new Error('ERROR: Batch transaction failed'), undefined);
      } else if (miningError) {
        onError(miningError, data?.receipts?.[0].transactionHash);
      } else if (failureReason && txReverted) {
        onError(failureReason, data?.receipts?.[0].transactionHash);
      }
    }
  }, [isSuccess, miningError, failureReason, mutationData?.id, txReverted, data]);

  return {
    execute: () => {
      // Sanity checks before sending the transaction
      if (!enabled) {
        console.log(`ERROR: A batch transaction was triggered before the transaction was enabled.
          Contract calls: ${JSON.stringify(parameters.calls, (_, value) => (typeof value === 'bigint' ? value.toString() : value))}
          `);
      } else if (!batchSupported) {
        console.log(
          'ERROR: A batch transaction was triggered but it looks like the connected wallet does not support it'
        );
      } else if (parameters.calls.length < 2) {
        console.log(
          'ERROR: You are attempting to send a single transaction as a batch transaction. It may be more gas efficient to send the transaction individually'
        );
      } else {
        // Call is legit, proceed to send the transaction
        sendCalls(sendCallsParameters);
      }
    },
    isLoading: isLoadingCapabilities || (isMining && !txReverted),
    prepared: !!batchSupported && !!enabled && !isLoadingCapabilities && !capabilitiesError,
    error: sendError || miningError
  };
}
