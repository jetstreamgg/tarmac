import { daiUsdsAbi, daiUsdsAddress, mcdDaiAddress } from '../generated';
import { useConnection, useChainId } from 'wagmi';
import { WriteHook, WriteHookParams } from '../hooks';
import { useTokenAllowance } from '../tokens/useTokenAllowance';
import { useWriteContractFlow } from '../shared/useWriteContractFlow';

// Calls the join function on the upgrader contract that supplies USDS and returns DAI
export function useDaiToUsds({
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

  // Get the allowance of DAI to be used by the upgrader contract
  const { data: allowance, error: allowanceError } = useTokenAllowance({
    chainId,
    contractAddress: mcdDaiAddress[chainId as keyof typeof mcdDaiAddress],
    owner: address,
    spender: daiUsdsAddress[chainId as keyof typeof daiUsdsAddress]
  });

  const enabled =
    paramEnabled && isConnected && !!allowance && amount !== 0n && allowance >= amount && !!address;

  const writeContractFlowResults = useWriteContractFlow({
    address: daiUsdsAddress[chainId as keyof typeof daiUsdsAddress],
    abi: daiUsdsAbi,
    functionName: 'daiToUsds',
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
