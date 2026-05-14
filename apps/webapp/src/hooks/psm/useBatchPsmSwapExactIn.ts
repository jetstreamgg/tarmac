import { useConnection, useChainId } from 'wagmi';
import { BatchWriteHook, BatchWriteHookParams } from '../hooks';
import { psm3L2Abi, psm3L2Address } from '../generated';
import { useTokenAllowance } from '../tokens/useTokenAllowance';
import { useTransactionFlow } from '../shared/useTransactionFlow';
import { getWriteContractCall } from '../shared/getWriteContractCall';
import { Call, erc20Abi } from 'viem';

export function useBatchPsmSwapExactIn({
  assetIn,
  assetOut,
  amountIn,
  minAmountOut,
  referralCode = 0n,
  enabled: paramEnabled = true,
  shouldUseBatch = true,
  onMutate = () => null,
  onSuccess = () => null,
  onError = () => null,
  onStart = () => null
}: BatchWriteHookParams & {
  assetIn: `0x${string}`;
  assetOut: `0x${string}`;
  amountIn: bigint;
  minAmountOut: bigint;
  referralCode?: bigint;
}): BatchWriteHook {
  const chainId = useChainId();
  const { address, isConnected } = useConnection();
  const psmAddress = psm3L2Address[chainId as keyof typeof psm3L2Address];

  // Get the allowance of the input asset to be used by the PSM contract
  const { data: allowance, error: allowanceError } = useTokenAllowance({
    chainId,
    contractAddress: assetIn,
    owner: address,
    spender: psmAddress
  });

  const hasAllowance = allowance !== undefined && allowance >= amountIn;

  // Calls for the batch transaction
  const approveCall = getWriteContractCall({
    to: assetIn,
    abi: erc20Abi,
    functionName: 'approve',
    args: [psmAddress, amountIn]
  });

  const swapExactInCall = getWriteContractCall({
    to: psmAddress,
    abi: psm3L2Abi,
    functionName: 'swapExactIn',
    args: [assetIn, assetOut, amountIn, minAmountOut, address!, referralCode]
  });

  const calls: Call[] = [];
  if (!hasAllowance) calls.push(approveCall);
  calls.push(swapExactInCall);

  const enabled = paramEnabled && isConnected && allowance !== undefined && amountIn !== 0n && !!address;

  const transactionFlowResults = useTransactionFlow({
    calls,
    shouldUseBatch,
    chainId,
    enabled,
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
