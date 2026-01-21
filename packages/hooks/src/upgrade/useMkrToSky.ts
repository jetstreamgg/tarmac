import { mkrAddress, mkrSkyAbi, mkrSkyAddress } from '../generated';
import { useConnection, useChainId } from 'wagmi';
import { WriteHook, WriteHookParams } from '../hooks';
import { useTokenAllowance } from '../tokens/useTokenAllowance';
import { useWriteContractFlow } from '../shared/useWriteContractFlow';

// Calls the join function on the upgrader contract that supplies SKY and returns MKR
export function useMkrToSky({
  amount,
  enabled: paramEnabled = true,
  gas,
  onMutate = () => null,
  onSuccess = () => null,
  onError = () => null,
  onStart = () => null
}: WriteHookParams & {
  amount: bigint;
}): WriteHook {
  const chainId = useChainId();
  const { address, isConnected } = useConnection();

  // Get the allowance of MKR to be used by the upgrader contract
  const { data: allowance, error: allowanceError } = useTokenAllowance({
    chainId,
    contractAddress: mkrAddress[chainId as keyof typeof mkrAddress],
    owner: address,
    spender: mkrSkyAddress[chainId as keyof typeof mkrSkyAddress]
  });

  const enabled = !!(
    paramEnabled &&
    isConnected &&
    allowance &&
    amount !== 0n &&
    allowance >= amount &&
    address
  );

  const writeContractFlowResults = useWriteContractFlow({
    address: mkrSkyAddress[chainId as keyof typeof mkrSkyAddress],
    abi: mkrSkyAbi,
    functionName: 'mkrToSky',
    args: [address!, amount],
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
