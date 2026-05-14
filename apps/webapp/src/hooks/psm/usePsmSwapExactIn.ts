import { useConnection, useChainId } from 'wagmi';
import { WriteHook, WriteHookParams } from '../hooks';
import { psm3L2Abi, psm3L2Address } from '../generated';
import { useTokenAllowance } from '../tokens/useTokenAllowance';
import { useWriteContractFlow } from '../shared/useWriteContractFlow';

export function usePsmSwapExactIn({
  assetIn,
  assetOut,
  amountIn,
  minAmountOut,
  referralCode = 0n,
  enabled: paramEnabled = true,
  gas,
  onMutate = () => null,
  onSuccess = () => null,
  onError = () => null,
  onStart = () => null
}: WriteHookParams & {
  assetIn: `0x${string}`;
  assetOut: `0x${string}`;
  amountIn: bigint;
  minAmountOut: bigint;
  referralCode?: bigint;
}): WriteHook {
  const chainId = useChainId();
  const { address, isConnected } = useConnection();

  // Get the allowance of the input asset to be used by the PSM contract
  const { data: allowance, error: allowanceError } = useTokenAllowance({
    chainId,
    contractAddress: assetIn,
    owner: address,
    spender: psm3L2Address[chainId as keyof typeof psm3L2Address]
  });

  const enabled =
    paramEnabled && isConnected && !!allowance && amountIn !== 0n && allowance >= amountIn && !!address;

  const writeContractFlowResults = useWriteContractFlow({
    address: psm3L2Address[chainId as keyof typeof psm3L2Address],
    abi: psm3L2Abi,
    functionName: 'swapExactIn',
    args: [assetIn, assetOut, amountIn, minAmountOut, address!, referralCode],
    chainId,
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
