import { usdsSkyRewardAbi } from '../generated';
import { useConnection, useChainId } from 'wagmi';
import { BatchWriteHookParams } from '../hooks';
import { ZERO_ADDRESS } from '../constants';
import { useTokenAllowance } from '../tokens/useTokenAllowance';
import { getWriteContractCall } from '../shared/getWriteContractCall';
import { ApproveThenActHook, useApproveThenAct } from '../shared/useApproveThenAct';

/**
 * Supply into a StakingRewards farm: optional approve → `stake(amount, ref)`.
 * The farm address is a parameter since there are many of them; every farm
 * shares the `stake` ABI.
 */
export function useBatchRewardsSupply({
  contractAddress,
  supplyTokenAddress,
  amount,
  ref = 0,
  enabled = true,
  ...flow
}: BatchWriteHookParams & {
  amount: bigint;
  contractAddress: `0x${string}` | undefined;
  supplyTokenAddress: `0x${string}` | undefined;
  ref?: number;
}): ApproveThenActHook {
  const chainId = useChainId();
  const { address } = useConnection();
  const { data: allowance, error: allowanceError } = useTokenAllowance({
    chainId,
    contractAddress: supplyTokenAddress,
    spender: contractAddress,
    owner: address
  });

  return useApproveThenAct({
    ...flow,
    chainId,
    enabled: enabled && amount !== 0n && address !== ZERO_ADDRESS,
    legs: [
      {
        approve: { token: supplyTokenAddress, spender: contractAddress, amount, allowance, allowanceError },
        calls:
          contractAddress && supplyTokenAddress
            ? [
                getWriteContractCall({
                  to: contractAddress,
                  abi: usdsSkyRewardAbi,
                  functionName: 'stake',
                  args: [amount, ref]
                })
              ]
            : []
      }
    ]
  });
}
