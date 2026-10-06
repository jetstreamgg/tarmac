import { useCallback, useEffect, useRef, useState } from 'react';
import { BatchWriteHook, TxMutateVariables, UseTransactionFlowParameters } from '../hooks';
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

  // Bundling is only ever on the table for more than one call, and only when the caller
  // asked for it. `batchSupported` is undefined while the probe is in flight, so this is
  // false until the wallet answers.
  const batchPossible = shouldUseBatch && calls.length > 1;
  const walletBatches = batchPossible && !!batchSupported;

  // `wallet_getCapabilities` is a round trip to the WALLET, not to an RPC — instant over
  // an injected provider, seconds over a WalletConnect relay or a wallet that rejects the
  // method. It only decides anything when bundling is possible: with a single call the
  // sequential path is the answer whatever the wallet replies. Gating the simulation on
  // the probe regardless made every one-call flow wait the probe out BEFORE its `eth_call`
  // was even sent — two round trips in series where one would do. That is what left the
  // claim modal's Confirm disabled for seconds: every claim is a single call (Merkl claims
  // every selected token in one `claim`, an ecosystem row is one `getReward`), and the
  // portfolio page mounts no other flow to warm the probe first, so the wait landed in
  // full on the first claim opened. Claiming something else first "fixed" it only because
  // that modal had already paid for the probe.
  const routeUndecided = batchPossible && isLoadingCapabilities;

  // The route a send went out on, held from the moment a flow hands a request to the
  // wallet (its onMutate — an execute() that bails early never gets there, so there is
  // nothing to release) until that send settles. The live route can move under an
  // in-flight send: a change of calls starts a fresh batch simulation with no verdict
  // yet (on a chain whose RPC can't simulate a bundle that reads as "batch" until it
  // fails again), and a multi-step sequential run whose calls change mid-way would
  // otherwise hand its remaining steps to the batch flow.
  const [sendRoute, setSendRoute] = useState<'batch' | 'sequential' | null>(null);
  // The sequential step reached, for its error callback: a failure after a step has
  // mined leaves the run resumable, and the resume must stay sequential.
  const sequentialStep = useRef(0);

  const commonTransactionParameters = {
    calls,
    onStart,
    onSuccess: (hash: string | undefined) => {
      setSendRoute(null);
      onSuccess?.(hash);
    },
    chainId
  };

  // Use batch flow. Its send leg is gated on the wallet's answer, but its prepare-time
  // simulation is not: that is an RPC round trip of its own, and for the same reason as
  // above it must not queue behind the wallet probe. It runs while the wallet's answer
  // is pending or once the wallet says it bundles — never after any other answer (a
  // wallet without EIP-5792 rejects the probe, which reads as "unknown", not "no").
  const batchResults = useSendBatchTransactionFlow({
    ...commonTransactionParameters,
    onMutate: (variables?: TxMutateVariables) => {
      setSendRoute('batch');
      onMutate?.(variables);
    },
    onError: (error: Error, hash: string | undefined) => {
      setSendRoute(null);
      onError?.(error, hash);
    },
    enabled: enabled && walletBatches,
    // Not while a send is out: a refetch (on focus) would run against the state the
    // send itself changes, and a bundle already signed has nothing left to gate.
    simulateEnabled: enabled && (walletBatches || routeUndecided) && sendRoute === null
  });

  // A wallet that bundles on a chain whose RPC can't simulate a bundle would otherwise
  // sit on a Confirm that never enables. The calls are still validated one at a time on
  // the sequential path, so route there — N signatures instead of one, never an
  // unsimulated send. Only calls the sequential flow can simulate make the move: it needs
  // each call's abi and function name, and a raw `{ to, data }` leg (stake's bundled
  // multicall legs) would stall it after the first step. Those stay on the batch route,
  // failed closed.
  const sequentialCapable = calls.every(call => {
    const { abi, functionName } = call as { abi?: unknown; functionName?: unknown };
    return !!abi && !!functionName;
  });
  // A held batch route only holds while bundling still applies: calls that shrank to one
  // (a new amount on a page-hosted form whose abandoned prompt never settled) have
  // nothing to bundle, and holding would leave both flows disabled.
  const useBatch =
    sendRoute === 'batch'
      ? walletBatches
      : sendRoute === 'sequential'
        ? false
        : walletBatches && (!batchResults.batchUnavailable || !sequentialCapable);

  // Use sequential flow
  const sequentialResults = useSequentialTransactionFlow({
    ...commonTransactionParameters,
    onMutate: (variables?: TxMutateVariables) => {
      setSendRoute('sequential');
      onMutate?.(variables);
    },
    onError: (error: Error, hash: string) => {
      if (sequentialStep.current === 0) setSendRoute(null);
      onError?.(error, hash);
    },
    // The caller's gate is followed as is, mid-run too: it carries safety checks (the
    // USDC supply's PSM fee gate) that must stop a run. A form whose amount check a run
    // invalidates (a DAI→USDS leg spends the DAI it was validated against) relaxes that
    // check itself while the run is active (useTransactionRunActive).
    enabled: enabled && !useBatch && !routeUndecided,
    gcTime
  });

  useEffect(() => {
    sequentialStep.current = sequentialResults.currentCallIndex;
  }, [sequentialResults.currentCallIndex]);

  // Return the appropriate results based on useBatch, carrying the calls and the routing
  // decision so callers can estimate what this flow costs without rebuilding calldata.
  // Wrapped to release the route; keeps the identity of the flow's own reset, so
  // consumers that key effects on it see no extra changes.
  const selected = useBatch ? batchResults : sequentialResults;
  const { reset: selectedReset } = selected;
  const reset = useCallback(() => {
    setSendRoute(null);
    selectedReset();
  }, [selectedReset]);

  return {
    ...selected,
    reset,
    calls,
    isBatch: useBatch,
    nextCalls: useBatch ? calls : sequentialResults.nextCalls
  };
}
