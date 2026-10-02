import { BatchWriteHook, UseTransactionFlowParameters } from '../hooks';
import { useTransactionFlow } from './useTransactionFlow';

/**
 * `useTransactionFlow` for the approve-then-act batch hooks: every one of them
 * reads an allowance to decide whether the approve leg is needed, and surfaces
 * that read's error behind the flow's own. Each hook still builds its calls
 * and its `enabled` gate; this owns the shared tail.
 */
export function useBatchWriteFlow({
  allowanceError,
  ...parameters
}: UseTransactionFlowParameters & {
  /** The allowance read's error, reported when the flow itself has none. */
  allowanceError: Error | null;
}): BatchWriteHook {
  const transactionFlowResults = useTransactionFlow(parameters);

  return {
    ...transactionFlowResults,
    error: transactionFlowResults.error || allowanceError
  };
}
