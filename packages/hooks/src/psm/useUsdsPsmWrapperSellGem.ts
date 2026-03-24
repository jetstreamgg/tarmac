import { useChainId, useConnection } from 'wagmi';
import { WriteHook, WriteHookParams } from '../hooks';
import { useTokenAllowance } from '../tokens/useTokenAllowance';
import { useWriteContractFlow } from '../shared/useWriteContractFlow';
import { usdcAddress } from '../generated';
import { usdsPsmWrapperAbi, usdsPsmWrapperAddress } from './usdsPsmWrapper';

export function useUsdsPsmWrapperSellGem({
  gemAmt,
  usr,
  chainIdOverride,
  enabled: paramEnabled = true,
  gas,
  onMutate = () => null,
  onSuccess = () => null,
  onError = () => null,
  onStart = () => null
}: WriteHookParams & {
  gemAmt: bigint;
  usr?: `0x${string}`;
  chainIdOverride?: number;
}): WriteHook {
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

  const enabled =
    paramEnabled && isConnected && allowance !== undefined && gemAmt !== 0n && allowance >= gemAmt && !!recipient;

  const writeContractFlowResults = useWriteContractFlow({
    address: wrapperAddress,
    abi: usdsPsmWrapperAbi,
    functionName: 'sellGem',
    args: [recipient!, gemAmt],
    chainId: effectiveChainId,
    enabled,
    gas,
    onMutate,
    onSuccess,
    onError,
    onStart
  });

  return {
    ...writeContractFlowResults,
    prepareError: writeContractFlowResults.prepareError || allowanceError
  };
}
