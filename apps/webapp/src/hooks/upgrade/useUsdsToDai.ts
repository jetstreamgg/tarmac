import { daiUsdsAbi, daiUsdsAddress, usdsAddress } from '../generated';
import { useConnection, useChainId } from 'wagmi';
import { WriteHook, WriteHookParams } from '../hooks';
import { useTokenAllowance } from '../tokens/useTokenAllowance';
import { useWriteContractFlow } from '../shared/useWriteContractFlow';

// Calls the ex function on the upgrader contract to revert USDS to DAI
export function useUsdsToDai({
  amount,
  enabled: paramEnabled = true,
  gas,
  onMutate,
  onSuccess = () => null,
  onError = () => null,
  onStart = () => null
}: WriteHookParams & {
  amount: bigint;
}): WriteHook {
  const chainId = useChainId();
  const { address, isConnected } = useConnection();

  // Get the allowance of USDS to be used by the upgrader contract
  const { data: allowance, error: allowanceError } = useTokenAllowance({
    chainId,
    contractAddress: usdsAddress[chainId as keyof typeof usdsAddress],
    owner: address,
    spender: daiUsdsAddress[chainId as keyof typeof daiUsdsAddress]
  });

  const enabled =
    paramEnabled && isConnected && !!allowance && amount !== 0n && allowance >= amount && !!address;

  const writeContractFlowResults = useWriteContractFlow({
    address: daiUsdsAddress[chainId as keyof typeof daiUsdsAddress],
    abi: daiUsdsAbi,
    functionName: 'usdsToDai',
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
