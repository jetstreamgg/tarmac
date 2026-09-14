import type { Call } from 'viem';
import { useIsBatchSupported } from '@/hooks';
import { useBatchToggle } from '@/modules/ui/hooks/useBatchToggle';
import type { TransactionStep } from '@/modules/ui/components/TransactionModal';

/**
 * What every module's launch hook returns — the seam between a product's
 * transaction modal and its (unmodified) engines. The savings/vault/rewards/
 * stusds/upgrade launch hooks all expose this shape.
 */
export interface EngineLaunchResult {
  /** Fires the routed engine call directly (txCallbacks already spread in). */
  execute: () => void;
  /** Steps for the configured flow, matching the engine's call count. */
  steps: TransactionStep[];
  /** Whether the routed engine hook is ready to execute. */
  prepared: boolean;
  isLoading: boolean;
  error: Error | null;
  /** The routed engine's calls, for estimating the flow's network fee. */
  calls: Call[];
  /** Whether those calls go out bundled — the batch costs less than the sequence. */
  isBatch: boolean;
}

/** The slice of a routed engine hook's result the launch seam reads. */
export type EngineHookResult = {
  execute: () => void;
  prepared: boolean;
  isLoading: boolean;
  error: Error | null;
  calls?: Call[];
  isBatch?: boolean;
  /** Plain-write engines report a failed prepare simulation here. */
  prepareError?: Error | null;
};

/**
 * Honour the user's batch toggle: bundle approve+action into one EIP-5792 call
 * only when opted in AND the wallet supports it. `useTransactionFlow`
 * additionally gates on calls.length > 1, so a no-approval flow stays a single
 * sequential signature regardless of this flag. `also` narrows further where a
 * module carries its own batching condition (the stake hooks' legacy clause).
 */
export function useShouldUseBatch(also: boolean = true): boolean {
  const [batchEnabled] = useBatchToggle();
  const { data: batchSupported } = useIsBatchSupported();
  return !!batchEnabled && !!batchSupported && also;
}

/**
 * Map the routed engine hook onto the launch result. Plain-write engines
 * report a failed prepare simulation via `prepareError` (the batch engines
 * fold everything into `error`) — promoted so the modal surfaces simulation
 * failures, the stUSDS launch precedent. `execute` can be overridden where
 * the launch hook routes it itself (the savings seam).
 */
export function toLaunchResult(
  activeHook: EngineHookResult,
  steps: TransactionStep[],
  execute: () => void = activeHook.execute
): EngineLaunchResult {
  return {
    execute,
    steps,
    prepared: activeHook.prepared,
    isLoading: activeHook.isLoading,
    error: activeHook.error ?? activeHook.prepareError ?? null,
    calls: activeHook.calls ?? [],
    isBatch: !!activeHook.isBatch
  };
}
