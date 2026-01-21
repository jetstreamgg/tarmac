import { usdsSkyRewardAbi } from '../generated';
import { useConnection, useChainId } from 'wagmi';
import { WriteHook, WriteHookParams } from '../hooks';
import { ZERO_ADDRESS } from '../constants';
import { useTokenAllowance } from '../tokens/useTokenAllowance';
import { useWriteContractFlow } from '../shared/useWriteContractFlow';

// Allows user to supply in a rewards contract
// We need to provide the contract address of the rewards contract since there are many of them
export function useRewardsSupply({
  contractAddress,
  supplyTokenAddress,
  onMutate = () => null,
  onSuccess = () => null,
  onError = () => null,
  onStart = () => null,
  amount,
  enabled: paramEnabled,
  gas,
  ref = 0
}: WriteHookParams & {
  amount: bigint;
  contractAddress: `0x${string}` | undefined;
  supplyTokenAddress: `0x${string}` | undefined;
  ref?: number;
}): WriteHook {
  const chainId = useChainId();

  const { address } = useConnection();
  const { data: allowance } = useTokenAllowance({
    chainId,
    contractAddress: supplyTokenAddress,
    spender: contractAddress,
    owner: address
  });

  // Only enabled if users allowance is GTE their supply amount
  const amountValid = !!amount && amount !== 0n && !!allowance && allowance >= amount;
  const addressValid = !!address && address !== ZERO_ADDRESS;
  const enabled = !!paramEnabled && amountValid && addressValid && !!contractAddress;

  return useWriteContractFlow({
    address: contractAddress,
    abi: usdsSkyRewardAbi, // we should be able to use any rewards contract abi here
    functionName: 'stake',
    args: [amount, ref],
    chainId,
    gas,
    enabled,
    onMutate,
    onSuccess,
    onError,
    onStart
  });
}
