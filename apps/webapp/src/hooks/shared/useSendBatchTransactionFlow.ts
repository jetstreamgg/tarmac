import { type Config, useChainId, usePublicClient, useSendCalls, useWaitForCallsStatus } from 'wagmi';
import { useQuery } from '@tanstack/react-query';
import { BatchTransactionFlowHook, UseSendBatchTransactionFlowParameters } from '../hooks';
import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react';
import type { Call } from 'viem';
import {
  BaseError,
  InvalidParamsRpcError,
  MethodNotFoundRpcError,
  MethodNotSupportedRpcError,
  ResourceNotFoundRpcError,
  UnknownBundleIdError,
  UnsupportedProviderMethodError,
  WaitForCallsStatusTimeoutError
} from 'viem';
import { useIsBatchSupported } from './useIsBatchSupported';
import { useSimulateBatch } from './useSimulateBatch';
import { decodeRevert } from '@/lib/revertMessages/decodeRevert';
import { replayRevertedTransaction } from './replayRevertedTransaction';
import { TransactionRevertedError } from './useTransactionOutcome';

/** Ceiling on the gap between status polls while the wallet keeps erroring. */
const MAX_STATUS_RETRY_DELAY_MS = 30_000;
// Errors after which polling can never succeed: the method unsupported (4200,
// -32601, -32004) or the bundle id unknown (5730, and the -32602 / -32001 some
// wallets answer with instead). Not 4100 (unauthorized): a locked wallet can
// answer that and work again once unlocked.
const PERMANENT_STATUS_ERRORS = [
  UnsupportedProviderMethodError,
  MethodNotFoundRpcError,
  MethodNotSupportedRpcError,
  UnknownBundleIdError,
  InvalidParamsRpcError,
  ResourceNotFoundRpcError
];
const isPermanentStatusError = (error: unknown) =>
  error instanceof BaseError && error.walk(e => PERMANENT_STATUS_ERRORS.some(c => e instanceof c)) !== null;

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

  // Set by a reset() that found the bundle out (the modal closed mid-send):
  // it settles and reports, then the send clears. The send stays loading
  // meanwhile, so no second bundle can overlap it: a replaced send still fires
  // the mutation's callbacks when it settles.
  const detachedRef = useRef<{ onCleared?: () => void } | null>(null);

  // Initiate hook to send the batch transaction
  const {
    sendCalls,
    error: sendError,
    data: mutationData,
    isPending: isSendPending,
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
        if (detachedRef.current) finishDetached();
      }
    }
  });

  // Monitor tx, this is also compatible with Safe wallets. A timed-out or failed
  // poll is retried rather than reported, for as long as the bundle is watched:
  // it's with the wallet whatever the poll says (a Safe waits on co-signers for
  // as long as it takes), and reporting it put Retry on screen, which sends the
  // bundle a second time. Each attempt keeps viem's 60s timeout so a bundle
  // nobody watches any more stops being polled. A revert comes back in the
  // status (`failure`, or a reverted receipt), never as a poll error.
  const {
    isLoading: isMining,
    isSuccess,
    error: miningError,
    data
  } = useWaitForCallsStatus({
    id: mutationData?.id,
    query: {
      retry: (_count, error) => !isPermanentStatusError(error),
      retryDelay: (attempt, error) =>
        error instanceof WaitForCallsStatusTimeoutError
          ? 0
          : Math.min(1000 * 2 ** attempt, MAX_STATUS_RETRY_DELAY_MS)
    }
  });

  // A reverted leg is replayed to learn why before the failure is reported, so the
  // failure screen can name the reason. The replay never throws and gives up on its
  // own after a few seconds; until it settles the failure waits.
  //
  // The chain is fixed when the bundle id first appears, as in useTransactionOutcome:
  // the wallet can switch chains with the failure on screen, and a replay keyed on the
  // live chain would run again there, miss the hash and report the failure twice.
  const connectedChainId = useChainId();
  const liveChainId = parameters.chainId ?? connectedChainId;
  const [sentOn, setSentOn] = useState<{ id?: string; chainId: number }>({ chainId: liveChainId });
  if (mutationData?.id !== sentOn.id) setSentOn({ id: mutationData?.id, chainId: liveChainId });
  const sentChainId = mutationData?.id === sentOn.id ? sentOn.chainId : liveChainId;
  const statusClient = usePublicClient({ chainId: sentChainId });
  const receipts = data?.receipts ?? [];
  const revertedIndex = receipts.findIndex(receipt => receipt.status === 'reverted');
  const revertedReceipt = revertedIndex >= 0 ? receipts[revertedIndex] : undefined;
  // A wallet that sends the legs as separate transactions can land an earlier one in
  // the same block (Ambire on an EOA, APP-637). The replay runs on the state before
  // the block, without that leg's effect (an allowance), and would name the wrong
  // reason — so it is skipped, and the failure reads generically.
  const replayable =
    !!revertedReceipt &&
    !!statusClient &&
    !receipts.slice(0, revertedIndex).some(receipt => receipt.blockNumber === revertedReceipt.blockNumber);
  const { data: batchRevert, isFetched: batchRevertExplained } = useQuery({
    queryKey: ['batchRevertReason', sentChainId, revertedReceipt?.transactionHash],
    queryFn: async () => (await replayRevertedTransaction(statusClient!, revertedReceipt!)) ?? null,
    enabled: replayable,
    retry: false,
    staleTime: Infinity,
    gcTime: 60_000,
    // Bounded by its own timeout; paused while offline, it would hold the failure back.
    networkMode: 'always'
  });
  const awaitingRevertReason = replayable && !batchRevertExplained;

  const finishDetached = useCallback(() => {
    const onCleared = detachedRef.current?.onCleared;
    detachedRef.current = null;
    resetSendCalls();
    onCleared?.();
  }, [resetSendCalls]);

  const sendInFlightRef = useRef(false);
  const sendInFlight = isSendPending || (!!mutationData?.id && !isSuccess && !miningError);
  useEffect(() => {
    sendInFlightRef.current = sendInFlight;
  }, [sendInFlight]);
  const reset = useCallback(
    (onCleared?: () => void) => {
      if (sendInFlightRef.current) {
        detachedRef.current = { onCleared };
        return;
      }
      detachedRef.current = null;
      resetSendCalls();
      onCleared?.();
    },
    [resetSendCalls]
  );

  // The consumer's callbacks are read through effect events: the settle effect
  // must not re-run because a caller passed a new inline function.
  const emitSuccess = useEffectEvent((hash?: string, blockNumber?: bigint) => onSuccess(hash, blockNumber));
  const emitError = useEffectEvent((err: Error, hash?: string) => onError(err, hash));
  useEffect(() => {
    if (mutationData?.id) {
      // A wallet that runs the bundle as separate transactions can report the whole bundle as
      // a success with a reverted leg among its receipts (Ambire on an EOA, APP-637).
      if (isSuccess && revertedReceipt) {
        if (awaitingRevertReason) return;
        emitError(
          new TransactionRevertedError(
            replayable ? (batchRevert ?? undefined) : undefined,
            'ERROR: Batch transaction failed'
          ),
          revertedReceipt.transactionHash
        );
      } else if (isSuccess && data.status === 'failure') {
        emitError(new Error('ERROR: Batch transaction failed'), undefined);
      } else if (isSuccess && data.status === 'success') {
        // A non-atomic bundle can land across blocks; the history refresh waits for the last.
        const blockNumbers = (data.receipts ?? []).map(receipt => receipt.blockNumber);
        emitSuccess(
          data.receipts?.[0]?.transactionHash,
          blockNumbers.length > 0 ? blockNumbers.reduce((a, b) => (b > a ? b : a)) : undefined
        );
      } else if (miningError) {
        emitError(miningError, data?.receipts?.[0]?.transactionHash);
      } else {
        return;
      }
      if (detachedRef.current) finishDetached();
    }
  }, [
    isSuccess,
    miningError,
    mutationData?.id,
    data,
    finishDetached,
    revertedReceipt,
    replayable,
    awaitingRevertReason,
    batchRevert
  ]);

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
        // Only the simulation's decoded revert rides along, for the failure screen —
        // not the error itself, whose cause chain carries the call's arguments (the
        // user's address among them) into Sentry.
        const error = Object.assign(
          new Error(
            simulation.error
              ? `Refusing to send a batch that failed simulation: ${simulation.error.message}`
              : 'Refusing to send a batch before its simulation has completed.'
          ),
          { revert: simulation.error ? decodeRevert(simulation.error) : undefined }
        );
        console.error(error);
        onError(error, undefined);
      } else {
        // Call is legit, proceed to send the transaction
        sendCalls(sendCallsParameters);
      }
    },
    data: data?.receipts?.[0]?.transactionHash,
    isLoading: isLoadingCapabilities || simulation.isLoading || isSendPending || isMining,
    prepared:
      !!batchSupported && !!enabled && !isLoadingCapabilities && !capabilitiesError && simulation.prepared,
    error: sendError || miningError || simulation.error,
    currentCallIndex: 0,
    reset,
    batchUnavailable: simulation.structuralFailure
  };
}
