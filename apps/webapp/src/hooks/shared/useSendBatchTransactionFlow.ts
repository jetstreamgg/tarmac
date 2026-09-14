import { useSendCalls, useWaitForCallsStatus } from 'wagmi';
import { BatchWriteHook, UseSendBatchTransactionFlowParameters } from '../hooks';
import { useEffect } from 'react';
import { isRevertedError, toError } from '../helpers';
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
    data: mutationData,
    reset: resetSendCalls
  } = useSendCalls({
    mutation: {
      // Bundled sendCalls have no single functionName — no leg to discriminate.
      onMutate: () => onMutate?.(),
      onSuccess: () => {
        if (onStart) {
          onStart(undefined);
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
        onSuccess(data.receipts?.[0]?.transactionHash);
      } else if (isSuccess && data.status === 'failure') {
        onError(new Error('ERROR: Batch transaction failed'), undefined);
      } else if (miningError) {
        onError(miningError, data?.receipts?.[0]?.transactionHash);
      } else if (failureReason && txReverted) {
        onError(toError(failureReason), data?.receipts?.[0]?.transactionHash);
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
      } else if (parameters.calls.some(call => !(call as { to?: unknown }).to)) {
        // Cross-chain-calldata backstop (APP-528): a batch is sent WITHOUT
        // per-call simulation (unlike the sequential flow), so a target address
        // that resolved to `undefined` — the shape a `Record<chainId, address>`
        // takes when read on a chain the product doesn't live on — would sail
        // straight into the wallet as a call to the zero address. Refuse it,
        // and report it through `onError` like any other failed send: the modal
        // has already advanced to its transaction screen by the time execute()
        // runs, so a silent refusal would leave it on an indefinite "Preparing"
        // loader with no way out — and nothing in Sentry. The provider's
        // onError lands the flow on ERROR (Back/Retry) and captures the error.
        // The modal's chain guard is the user-facing stop; this backstop
        // catches an address-map miss that reaches the engine anyway.
        const error = new Error(
          'A batch transaction has a call with no target address — refusing to send (likely a cross-chain address resolution miss).'
        );
        console.error(error);
        onError(error, undefined);
      } else {
        // Call is legit, proceed to send the transaction
        sendCalls(sendCallsParameters);
      }
    },
    data: data?.receipts?.[0]?.transactionHash,
    isLoading: isLoadingCapabilities || (isMining && !txReverted),
    prepared: !!batchSupported && !!enabled && !isLoadingCapabilities && !capabilitiesError,
    error: sendError || miningError,
    currentCallIndex: 0,
    reset: resetSendCalls
  };
}
