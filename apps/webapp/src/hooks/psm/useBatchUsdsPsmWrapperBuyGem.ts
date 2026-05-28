import { useChainId, useConnection } from 'wagmi';
import { BatchWriteHook, BatchWriteHookParams } from '../hooks';
import { useTokenAllowance } from '../tokens/useTokenAllowance';
import { useTransactionFlow } from '../shared/useTransactionFlow';
import { getWriteContractCall } from '../shared/getWriteContractCall';
import { usdsAddress } from '../generated';
import { Call, erc20Abi } from 'viem';
import { usdsPsmWrapperAbi, usdsPsmWrapperAddress } from './usdsPsmWrapper';

export function useBatchUsdsPsmWrapperBuyGem({
  gemAmt,
  usdsAmountInWad,
  usr,
  chainIdOverride,
  enabled: paramEnabled = true,
  shouldUseBatch = true,
  onMutate = () => null,
  onSuccess = () => null,
  onError = () => null,
  onStart = () => null
}: BatchWriteHookParams & {
  gemAmt: bigint;
  usdsAmountInWad: bigint;
  usr?: `0x${string}`;
  chainIdOverride?: number;
}): BatchWriteHook {
  const chainId = useChainId();
  const { address, isConnected } = useConnection();
  const effectiveChainId = chainIdOverride ?? chainId;
  const wrapperAddress = usdsPsmWrapperAddress[effectiveChainId as keyof typeof usdsPsmWrapperAddress];
  const recipient = usr ?? address;
  const usdsToken = usdsAddress[effectiveChainId as keyof typeof usdsAddress];

  const { data: allowance, error: allowanceError } = useTokenAllowance({
    chainId: effectiveChainId,
    contractAddress: usdsToken,
    owner: address,
    spender: wrapperAddress
  });

  const hasAllowance = allowance !== undefined && allowance >= usdsAmountInWad;

  const approveCall = getWriteContractCall({
    to: usdsToken,
    abi: erc20Abi,
    functionName: 'approve',
    args: [wrapperAddress, usdsAmountInWad]
  });

  const buyGemCall = getWriteContractCall({
    to: wrapperAddress,
    abi: usdsPsmWrapperAbi,
    functionName: 'buyGem',
    args: [recipient!, gemAmt]
  });

  const calls: Call[] = [];
  if (!hasAllowance) calls.push(approveCall);
  calls.push(buyGemCall);

  const enabled =
    paramEnabled &&
    isConnected &&
    allowance !== undefined &&
    gemAmt !== 0n &&
    usdsAmountInWad !== 0n &&
    !!recipient;

  const transactionFlowResults = useTransactionFlow({
    calls,
    shouldUseBatch,
    chainId: effectiveChainId,
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
