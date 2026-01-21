import { Call } from 'viem';
import { BatchWriteHook, BatchWriteHookParams } from '../hooks';
import { getWriteContractCall } from '../shared/getWriteContractCall';
import { useConnection, useChainId } from 'wagmi';
import { useAvailableTokenRewardContracts } from './useAvailableTokenRewardContracts';
import { useRewardContractsToClaim } from './useRewardContractsToClaim';
import { usdsSkyRewardAbi } from '../generated';
import { useTransactionFlow } from '../shared/useTransactionFlow';

export function useBatchClaimAllRewards({
  onMutate = () => null,
  onSuccess = () => null,
  onError = () => null,
  onStart = () => null,
  enabled: paramEnabled = true,
  shouldUseBatch = true
}: BatchWriteHookParams): BatchWriteHook {
  const chainId = useChainId();
  const { address } = useConnection();

  const rewardContracts = useAvailableTokenRewardContracts(chainId);
  const { data: rewardContractsToClaim } = useRewardContractsToClaim({
    rewardContractAddresses:
      rewardContracts?.map(({ contractAddress }) => contractAddress as `0x${string}`) || [],
    addresses: address,
    chainId,
    enabled: !!rewardContracts?.length && !!address
  });

  // Calls for the batch transaction
  const calls: Call[] =
    rewardContractsToClaim?.map(({ contractAddress }) =>
      getWriteContractCall({
        to: contractAddress,
        abi: usdsSkyRewardAbi,
        functionName: 'getReward',
        args: []
      })
    ) || [];

  const enabled = !!address && !!calls.length && paramEnabled;

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
