import { type Call } from 'viem';
import { useChainId } from 'wagmi';
import { BatchWriteHook, BatchWriteHookParams } from '../hooks';
import { useTransactionFlow } from './useTransactionFlow';

/**
 * Generic hook to execute an array of pre-built Call objects
 * using the transaction flow infrastructure.
 * Routes to batch or sequential execution based on wallet capabilities
 * and user preference.
 *
 * @param calls - Array of pre-built Call objects
 * @param shouldUseBatch - Whether to attempt batch execution (default: true)
 * @param enabled - Whether the hook is active
 */
export function useExecuteCalls({
  calls,
  onMutate = () => null,
  onSuccess = () => null,
  onError = () => null,
  onStart = () => null,
  shouldUseBatch = true,
  enabled: paramEnabled = true
}: BatchWriteHookParams & {
  calls: Call[];
}): BatchWriteHook {
  const chainId = useChainId();

  return useTransactionFlow({
    calls,
    chainId,
    enabled: paramEnabled && calls.length > 0,
    shouldUseBatch,
    onMutate,
    onStart,
    onSuccess,
    onError
  });
}
