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

  // TODO: Check how the implementation for Safe would work
  // Workaround to get `txHash` from Safe connector
  // const { connector } = useAccount();
  // const isSafeConnector = connector?.id === SAFE_CONNECTOR_ID;

  // const eventHash = useWaitForSafeTxHash({
  //   chainId,
  //   safeTxHash: mutationData?.id,
  //   isSafeConnector
  // });

  // // If the user is currently connected through the Safe connector, the txHash will only
  // // be populated after we get it from the Safe wallet contract event, if they're connected
  // // to any other connector, the txHash will be the one we get from the mutation
  // const txHash = useMemo(
  //   () => (isSafeConnector ? eventHash : mutationData?.id),
  //   [eventHash, mutationData?.id, isSafeConnector]
  // );

  // Monitor tx
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
