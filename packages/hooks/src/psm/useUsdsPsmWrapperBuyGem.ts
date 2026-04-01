import { useChainId, useConnection } from 'wagmi';
import { WriteHook, WriteHookParams } from '../hooks';
import { useTokenAllowance } from '../tokens/useTokenAllowance';
import { useWriteContractFlow } from '../shared/useWriteContractFlow';
import { usdsAddress } from '../generated';
import { usdsPsmWrapperAbi, usdsPsmWrapperAddress } from './usdsPsmWrapper';

export function useUsdsPsmWrapperBuyGem({
  gemAmt,
  usdsAmountInWad,
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
  usdsAmountInWad: bigint;
  usr?: `0x${string}`;
  chainIdOverride?: number;
}): WriteHook {
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

  const enabled =
    paramEnabled &&
    isConnected &&
    allowance !== undefined &&
    gemAmt !== 0n &&
    usdsAmountInWad !== 0n &&
    allowance >= usdsAmountInWad &&
    !!recipient;

  const writeContractFlowResults = useWriteContractFlow({
    address: wrapperAddress,
    abi: usdsPsmWrapperAbi,
    functionName: 'buyGem',
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
