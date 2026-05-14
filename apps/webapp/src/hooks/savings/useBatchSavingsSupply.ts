import { useConnection, useChainId } from 'wagmi';
import { BatchWriteHook, BatchWriteHookParams } from '../hooks';
import { useSavingsAllowance } from './useSavingsAllowance';
import { sUsdsAddress, sUsdsImplementationAbi } from './useReadSavingsUsds';
import { getWriteContractCall } from '../shared/getWriteContractCall';
import { usdsAddress } from '../generated';
import { Call, erc20Abi } from 'viem';
import { useTransactionFlow } from '../shared/useTransactionFlow';

export function useBatchSavingsSupply({
  amount,
  onMutate = () => null,
  onSuccess = () => null,
  onError = () => null,
  onStart = () => null,
  enabled: activeTabEnabled = true,
  shouldUseBatch = true,
  ref = 0
}: BatchWriteHookParams & {
  amount: bigint;
  ref?: number;
}): BatchWriteHook {
  const { address: connectedAddress, isConnected } = useConnection();
  const chainId = useChainId();
  const { data: allowance, error: allowanceError } = useSavingsAllowance();

  const hasAllowance = allowance !== undefined && allowance >= amount;

  // Calls for the batch transaction
  const approveCall = getWriteContractCall({
    to: usdsAddress[chainId as keyof typeof usdsAddress],
    abi: erc20Abi,
    functionName: 'approve',
    args: [sUsdsAddress[chainId as keyof typeof sUsdsAddress], amount]
  });

  const supplyCall = getWriteContractCall({
    to: sUsdsAddress[chainId as keyof typeof sUsdsAddress],
    abi: sUsdsImplementationAbi,
    functionName: 'deposit',
    args: [amount, connectedAddress!, ref]
  });

  const calls: Call[] = [];
  if (!hasAllowance) calls.push(approveCall);
  calls.push(supplyCall);

  const enabled =
    isConnected &&
    !!amount &&
    amount !== 0n &&
    allowance !== undefined &&
    activeTabEnabled &&
    !!connectedAddress;

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
    error: transactionFlowResults.error || allowanceError
  };
}
