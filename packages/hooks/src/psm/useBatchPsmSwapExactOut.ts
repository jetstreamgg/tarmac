import { useAccount, useChainId } from 'wagmi';
import { BatchWriteHook, BatchWriteHookParams } from '../hooks';
import { psm3L2Abi, psm3L2Address } from '../generated';
import { useTokenAllowance } from '../tokens/useTokenAllowance';
import { useSendBatchTransactionFlow } from '../shared/useSendBatchTransactionFlow';
import { getWriteContractCall } from '../shared/getWriteContractCall';
import { Call, erc20Abi } from 'viem';

export function useBatchPsmSwapExactOut({
  assetIn,
  assetOut,
  amountOut,
  maxAmountIn,
  referralCode = 0n,
  enabled: paramEnabled = true,
  onSuccess = () => null,
  onError = () => null,
  onStart = () => null
}: BatchWriteHookParams & {
  assetIn: `0x${string}`;
  assetOut: `0x${string}`;
  amountOut: bigint;
  maxAmountIn: bigint;
  referralCode?: bigint;
}): BatchWriteHook {
  const chainId = useChainId();
  const { address, isConnected } = useAccount();
  const psmAddress = psm3L2Address[chainId as keyof typeof psm3L2Address];

  // Get the allowance of the input asset to be used by the PSM contract
  const { data: allowance, error: allowanceError } = useTokenAllowance({
    chainId,
    contractAddress: assetIn,
    owner: address,
    spender: psmAddress
  });

  const hasAllowance = allowance !== undefined && allowance >= maxAmountIn;

  // Calls for the batch transaction
  const approveCall = getWriteContractCall({
    to: assetIn,
    abi: erc20Abi,
    functionName: 'approve',
    args: [psmAddress, maxAmountIn]
  });

  const swapExactOutCall = getWriteContractCall({
    to: psmAddress,
    abi: psm3L2Abi,
    functionName: 'swapExactOut',
    args: [assetIn, assetOut, amountOut, maxAmountIn, address!, referralCode]
  });

  const calls: Call[] = [];
  if (!hasAllowance) calls.push(approveCall);
  calls.push(swapExactOutCall);

  const enabled = paramEnabled && isConnected && allowance !== undefined && maxAmountIn !== 0n && !!address;

  const sendBatchTransactionFlowResults = useSendBatchTransactionFlow({
    calls,
    chainId,
    enabled,
    onSuccess,
    onError,
    onStart
  });

  return {
    ...sendBatchTransactionFlowResults,
    error: sendBatchTransactionFlowResults.error || allowanceError
  };
}
