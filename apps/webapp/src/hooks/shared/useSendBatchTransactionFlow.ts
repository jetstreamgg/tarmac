import { useSendCalls, useWaitForCallsStatus } from 'wagmi';
import { BatchTransactionFlowHook, UseSendBatchTransactionFlowParameters } from '../hooks';
import { useEffect, useEffectEvent } from 'react';
import type { Call } from 'viem';
import { WaitForCallsStatusTimeoutError } from 'viem';
import { isRevertedError, toError } from '../helpers';
import { Config } from '@wagmi/core';
import { useIsBatchSupported } from './useIsBatchSupported';
import { useSimulateBatch } from './useSimulateBatch';

/** Ceiling on the gap between status polls while the wallet keeps erroring. */
const MAX_STATUS_RETRY_DELAY_MS = 30_000;
// EIP-1193 / EIP-5792 codes after which polling can never succeed: unauthorized,
// method unsupported, unknown bundle id.
const PERMANENT_STATUS_ERROR_CODES = new Set([4100, 4200, 5730]);

function isPermanentStatusError(error: unknown): boolean {
  let e: unknown = error;
  for (let i = 0; i < 10 && e; i++) {
    const code = (e as { code?: unknown }).code;
    if (typeof code === 'number' && PERMANENT_STATUS_ERROR_CODES.has(code)) return true;
    e = (e as { cause?: unknown }).cause;
  }
  return false;
}

export function useSendBatchTransactionFlow<const calls extends readonly unknown[], config extends Config>(
  parameters: UseSendBatchTransactionFlowParameters<calls, config>
): BatchTransactionFlowHook {
  const {
    enabled,
    simulateEnabled = enabled,
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

  // Prepare-time simulation of the whole bundle — the batch counterpart of the per-call
  // `useSimulateContract` the sequential flow gates on. Nothing goes to the wallet unless
  // it ran clean (APP-537).
  const simulation = useSimulateBatch({
    calls: parameters.calls as readonly Call[],
    chainId: parameters.chainId,
    enabled: simulateEnabled
  });

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

  // Monitor tx, this is also compatible with Safe wallets. A timed-out or failed
  // poll is retried rather than reported, for as long as the bundle is watched:
  // it's with the wallet whatever the poll says (a Safe waits on co-signers for
  // as long as it takes), and reporting it put Retry on screen, which sends the
  // bundle a second time. Each attempt keeps viem's 60s timeout so a bundle
  // nobody watches any more stops being polled.
  const {
    isLoading: isMining,
    isSuccess,
    error: miningError,
    failureReason,
    data
  } = useWaitForCallsStatus({
    id: mutationData?.id,
    query: {
      retry: (_count, error) => !isRevertedError(error) && !isPermanentStatusError(error),
      retryDelay: (attempt, error) =>
        error instanceof WaitForCallsStatusTimeoutError
          ? 0
          : Math.min(1000 * 2 ** attempt, MAX_STATUS_RETRY_DELAY_MS)
    }
  });

  const txReverted = isRevertedError(failureReason);

  // The consumer's callbacks are read through effect events: the settle effect
  // must not re-run because a caller passed a new inline function.
  const emitSuccess = useEffectEvent((hash?: string) => onSuccess(hash));
  const emitError = useEffectEvent((err: Error, hash?: string) => onError(err, hash));
  useEffect(() => {
    if (mutationData?.id) {
      if (isSuccess && data.status === 'success') {
        emitSuccess(data.receipts?.[0]?.transactionHash);
      } else if (isSuccess && data.status === 'failure') {
        emitError(new Error('ERROR: Batch transaction failed'), undefined);
      } else if (miningError) {
        emitError(miningError, data?.receipts?.[0]?.transactionHash);
      } else if (failureReason && txReverted) {
        emitError(toError(failureReason), data?.receipts?.[0]?.transactionHash);
      }
    }
  }, [isSuccess, miningError, failureReason, mutationData?.id, txReverted, data]);

  return {
    execute: () => {
      // Sanity checks before sending the transaction
      if (!enabled) {
        console.error(`ERROR: A batch transaction was triggered before the transaction was enabled.
          Contract calls: ${JSON.stringify(parameters.calls, (_, value) => (typeof value === 'bigint' ? value.toString() : value))}
          `);
      } else if (!batchSupported) {
        console.error(
          'ERROR: A batch transaction was triggered but it looks like the connected wallet does not support it'
        );
      } else if (parameters.calls.length < 2) {
        console.error(
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
      } else if (!simulation.prepared) {
        // `prepared` only disables a button. This is the guarantee behind it: a bundle
        // that has not simulated clean never reaches `wallet_sendCalls`, whatever
        // called execute(). Reported like the backstop above, for the same reason.
        const error = new Error(
          simulation.error
            ? `Refusing to send a batch that failed simulation: ${simulation.error.message}`
            : 'Refusing to send a batch before its simulation has completed.'
        );
        console.error(error);
        onError(error, undefined);
      } else {
        // Call is legit, proceed to send the transaction
        sendCalls(sendCallsParameters);
      }
    },
    data: data?.receipts?.[0]?.transactionHash,
    isLoading: isLoadingCapabilities || simulation.isLoading || (isMining && !txReverted),
    prepared:
      !!batchSupported && !!enabled && !isLoadingCapabilities && !capabilitiesError && simulation.prepared,
    error: sendError || miningError || simulation.error,
    currentCallIndex: 0,
    reset: resetSendCalls,
    batchUnavailable: simulation.structuralFailure
  };
}
