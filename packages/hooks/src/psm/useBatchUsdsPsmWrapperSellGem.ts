import { useChainId, useConnection } from 'wagmi';
import { BatchWriteHook, BatchWriteHookParams } from '../hooks';
import { useTokenAllowance } from '../tokens/useTokenAllowance';
import { useTransactionFlow } from '../shared/useTransactionFlow';
import { getWriteContractCall } from '../shared/getWriteContractCall';
import { usdcAddress } from '../generated';
import { Call, erc20Abi } from 'viem';
import { usdsPsmWrapperAbi, usdsPsmWrapperAddress } from './usdsPsmWrapper';

export function useBatchUsdsPsmWrapperSellGem({
  gemAmt,
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
  usr?: `0x${string}`;
  chainIdOverride?: number;
}): BatchWriteHook {
  const chainId = useChainId();
  const { address, isConnected } = useConnection();
  const effectiveChainId = chainIdOverride ?? chainId;
  const wrapperAddress = usdsPsmWrapperAddress[effectiveChainId as keyof typeof usdsPsmWrapperAddress];
  const recipient = usr ?? address;
  const usdcToken = usdcAddress[effectiveChainId as keyof typeof usdcAddress];

  const { data: allowance, error: allowanceError } = useTokenAllowance({
    chainId: effectiveChainId,
    contractAddress: usdcToken,
    owner: address,
    spender: wrapperAddress
  });

  const hasAllowance = allowance !== undefined && allowance >= gemAmt;

  const approveCall = getWriteContractCall({
    to: usdcToken,
    abi: erc20Abi,
    functionName: 'approve',
    args: [wrapperAddress, gemAmt]
  });

  const sellGemCall = getWriteContractCall({
    to: wrapperAddress,
    abi: usdsPsmWrapperAbi,
    functionName: 'sellGem',
    args: [recipient!, gemAmt]
  });

  const calls: Call[] = [];
  if (!hasAllowance) calls.push(approveCall);
  calls.push(sellGemCall);

  const enabled =
    paramEnabled && isConnected && allowance !== undefined && gemAmt !== 0n && !!recipient;

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
