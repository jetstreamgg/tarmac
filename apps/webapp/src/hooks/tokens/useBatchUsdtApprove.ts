import { useConnection, useChainId } from 'wagmi';
import { BatchWriteHook, BatchWriteHookParams } from '../hooks';
import { getWriteContractCall } from '../shared/getWriteContractCall';
import { Call } from 'viem';
import { useTransactionFlow } from '../shared/useTransactionFlow';
import { usdtAbi } from '../generated';

export function useBatchUsdtApprove({
  tokenAddress,
  spender,
  amount,
  onMutate = () => null,
  onSuccess = () => null,
  onError = () => null,
  onStart = () => null,
  enabled: activeTabEnabled = true,
  shouldUseBatch = true
}: BatchWriteHookParams & {
  tokenAddress?: `0x${string}`;
  spender?: `0x${string}`;
  amount?: bigint;
}): BatchWriteHook {
  const { isConnected } = useConnection();
  const chainId = useChainId();

  // Build calls for USDT reset + approve batch transaction
  const calls: Call[] = [];

  if (spender && tokenAddress && amount) {
    // First call: Reset allowance to 0
    const resetCall = getWriteContractCall({
      to: tokenAddress,
      abi: usdtAbi,
      functionName: 'approve',
      args: [spender, 0n]
    });
    calls.push(resetCall);

    // Second call: Set allowance to desired amount
    const approveCall = getWriteContractCall({
      to: tokenAddress,
      abi: usdtAbi,
      functionName: 'approve',
      args: [spender, amount]
    });
    calls.push(approveCall);
  }

  const enabled =
    isConnected && !!tokenAddress && !!spender && !!amount && activeTabEnabled && calls.length === 2;

  const transactionFlowResults = useTransactionFlow({
    calls,
    chainId,
    enabled,
    shouldUseBatch,
    onMutate,
    onSuccess,
    onError,
    onStart
  });

  return {
    ...transactionFlowResults,
    // Ensure we have both calls prepared
    prepared: transactionFlowResults.prepared && calls.length === 2
  };
}
