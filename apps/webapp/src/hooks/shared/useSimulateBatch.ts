import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAccount, useChainId, usePublicClient } from 'wagmi';
import type { Call } from 'viem';
import { reportError } from '@/modules/sentry/reportError';
import { getCallsKey } from './networkFee';
import {
  isBatchSimulationError,
  isStructuralBatchSimulationError,
  isTransientBatchSimulationError,
  simulateBatch
} from './simulateBatch';

export type UseSimulateBatchParameters = {
  calls: readonly Call[];
  chainId?: number;
  enabled?: boolean;
  gcTime?: number;
};

export type UseSimulateBatchResult = {
  /** The bundle ran clean in simulation — the only state in which it may be sent. */
  prepared: boolean;
  isLoading: boolean;
  error: Error | null;
  /**
   * The RPC refused to run the simulation at all (rejected the state override or the
   * method). The calls may be fine; this chain just can't validate them as a bundle, so
   * the caller should fall back to the sequential flow rather than block.
   */
  structuralFailure: boolean;
  refetch: () => void;
};

/**
 * Prepare-time simulation of a batch — the bundled flow's counterpart to the per-call
 * `useSimulateContract` the sequential flow gates on. Fails closed: `prepared` is only
 * true on a clean run, and every other outcome (a sub-call revert, an RPC that can't do
 * it, a request that failed) leaves it false with the reason in `error`.
 *
 * Keyed on the encoded calls, the account and the chain, so a changed amount or an
 * allowance that lands re-simulates; refetch-on-focus is harmless here (no dispatch
 * side effect, unlike the sequential hook — APP-417).
 */
export function useSimulateBatch({
  calls,
  chainId,
  enabled = true,
  gcTime = 30_000
}: UseSimulateBatchParameters): UseSimulateBatchResult {
  const connectedChainId = useChainId();
  const resolvedChainId = chainId ?? connectedChainId;
  const { address } = useAccount();
  const client = usePublicClient({ chainId: resolvedChainId });

  // An engine can hand over a call it can't encode yet (an arg only known after
  // connect). Not simulatable, so not prepared — never a crash.
  const callsKey = useMemo(() => {
    try {
      return getCallsKey(calls);
    } catch {
      return null;
    }
  }, [calls]);

  const { isSuccess, isLoading, error, refetch } = useQuery({
    queryKey: ['simulate-batch', resolvedChainId, address, callsKey],
    queryFn: () => simulateBatch({ client: client!, chainId: resolvedChainId, account: address!, calls }),
    enabled: enabled && !!client && !!address && calls.length > 0 && callsKey !== null,
    // A revert or an unsupported RPC won't change on a retry; only a failed request might.
    retry: (failureCount, err) => isTransientBatchSimulationError(err) && failureCount < 3,
    gcTime
  });

  const structuralFailure = isStructuralBatchSimulationError(error);

  // Every failed outcome is worth a Sentry event: the signal to watch after launch is
  // "the batch sim blocked, the user went sequential and it succeeded" — a false block.
  useEffect(() => {
    if (!error) return;
    reportError(error, {
      module: 'transactions',
      flow: 'batch-simulation',
      type: isBatchSimulationError(error) ? error.kind : 'unknown',
      level: structuralFailure ? 'error' : 'warning',
      extra: {
        chainId: resolvedChainId,
        callCount: calls.length,
        callIndex: isBatchSimulationError(error) ? error.callIndex : undefined
      }
    });
  }, [error, structuralFailure, resolvedChainId, calls.length]);

  return {
    prepared: isSuccess,
    isLoading,
    error: error ?? null,
    structuralFailure,
    refetch
  };
}
