import { useConnection, useChainId } from 'wagmi';
import { BatchWriteHook, BatchWriteHookParams } from '../hooks';
import { useRewardContractsToClaim } from '../rewards/useRewardContractsToClaim';
import { useStakeRewardContracts } from './useStakeRewardContracts';
import { getWriteContractCall, stakeModuleAddress, useStakeUrnAddress, useTransactionFlow } from '..';
import { Call } from 'viem';
import { stakeModuleAbi } from '../generated';

export function useBatchStakeClaimAllRewards({
  index,
  onMutate = () => null,
  onSuccess = () => null,
  onError = () => null,
  onStart = () => null,
  enabled: paramEnabled = true,
  shouldUseBatch = true
}: BatchWriteHookParams & {
  index: bigint | undefined;
}): BatchWriteHook {
  const chainId = useChainId();
  const { address } = useConnection();

  const { data: urnAddress } = useStakeUrnAddress(index || 0n);
  const { data: stakeRewardContracts } = useStakeRewardContracts();
  const { data: rewardContractsToClaim } = useRewardContractsToClaim({
    rewardContractAddresses: stakeRewardContracts?.map(({ contractAddress }) => contractAddress) || [],
    addresses: urnAddress,
    chainId,
    enabled: !!stakeRewardContracts && !!urnAddress
  });

  // Calls for the batch transaction
  const calls: Call[] =
    rewardContractsToClaim?.map(({ contractAddress }) =>
      getWriteContractCall({
        to: stakeModuleAddress[chainId as keyof typeof stakeModuleAddress],
        abi: stakeModuleAbi,
        functionName: 'getReward',
        args: [address!, index!, contractAddress, address!]
      })
    ) || [];

  const enabled = index !== undefined && !!address && !!calls.length && paramEnabled;

  return useTransactionFlow({
    calls,
    chainId,
    enabled,
    shouldUseBatch,
    onMutate,
    onSuccess,
    onError,
    onStart
  });
}
