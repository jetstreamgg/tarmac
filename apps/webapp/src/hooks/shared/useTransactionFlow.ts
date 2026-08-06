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

  // Bundling is only ever on the table for more than one call, and only when the caller
  // asked for it. `batchSupported` is undefined while the probe is in flight, so this is
  // false until the wallet answers.
  const batchPossible = shouldUseBatch && calls.length > 1;
  const useBatch = batchPossible && !!batchSupported;

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
    enabled: enabled && !useBatch && !routeUndecided,
    gcTime
  });

  // Use batch flow. `useBatch` already implies the probe has answered, so it carries the
  // loading gate the sequential path spells out.
  const batchResults = useSendBatchTransactionFlow({
    ...commonTransactionParameters,
    enabled: enabled && useBatch
  });

  // Return the appropriate results based on useBatch, carrying the calls and the routing
  // decision so callers can estimate what this flow costs without rebuilding calldata.
  return { ...(useBatch ? batchResults : sequentialResults), calls, isBatch: useBatch };
}
