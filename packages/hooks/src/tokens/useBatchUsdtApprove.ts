import { useAccount, useChainId } from 'wagmi';
import { BatchWriteHook, BatchWriteHookParams } from '../hooks';
import { getWriteContractCall } from '../shared/getWriteContractCall';
import { Call, erc20Abi } from 'viem';
import { useTransactionFlow } from '../shared/useTransactionFlow';
import { usdtAbi, usdtAddress, usdtSepoliaAddress } from '../generated';
import { sepolia } from 'viem/chains';
import { useTradeAllowance } from '../trade/useTradeAllowance';

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
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { data: currentAllowance } = useTradeAllowance(tokenAddress);

  // Check if this is a USDT contract
  const isUsdt =
    chainId === sepolia.id
      ? tokenAddress === usdtSepoliaAddress[chainId as keyof typeof usdtSepoliaAddress]
      : tokenAddress === usdtAddress[chainId as keyof typeof usdtAddress];

  // Check if we need to reset allowance (USDT only)
  const needsReset =
    isUsdt &&
    currentAllowance !== undefined &&
    amount !== undefined &&
    currentAllowance > 0n &&
    currentAllowance < amount;

  // Calls for the batch transaction
  const calls: Call[] = [];

  if (needsReset && spender && tokenAddress) {
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
      args: [spender, amount!]
    });
    calls.push(approveCall);
  } else if (!needsReset && spender && tokenAddress && amount) {
    // Normal approval for non-USDT or when no reset is needed
    const approveCall = getWriteContractCall({
      to: tokenAddress,
      abi: isUsdt ? usdtAbi : erc20Abi, // Use appropriate ABI
      functionName: 'approve',
      args: [spender, amount]
    });
    calls.push(approveCall);
  }

  const enabled =
    isConnected &&
    !!tokenAddress &&
    !!spender &&
    !!amount &&
    activeTabEnabled &&
    currentAllowance !== undefined &&
    calls.length > 0;

  const transactionFlowResults = useTransactionFlow({
    calls,
    chainId,
    enabled,
    shouldUseBatch: shouldUseBatch && needsReset, // Only use batch for USDT reset
    onMutate,
    onSuccess,
    onError,
    onStart
  });

  return {
    ...transactionFlowResults,
    // Override prepared to indicate whether we need a batch transaction
    prepared: transactionFlowResults.prepared && (needsReset ? calls.length === 2 : calls.length === 1)
  };
}
