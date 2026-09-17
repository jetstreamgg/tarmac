import { useConnection, useChainId } from 'wagmi';
import { Abi } from 'viem';
import { BatchWriteHookParams } from '../hooks';
import { stUsdsAddress, stUsdsImplementationAbi, usdsAddress } from '../generated';
import { useStUsdsAllowance } from './useStUsdsAllowance';
import { getWriteContractCall } from '../shared/getWriteContractCall';
import { ApproveThenActHook, useApproveThenAct } from '../shared/useApproveThenAct';

/** USDS → stUSDS: optional approve → `deposit(amount, user[, referral])`. */
export function useBatchStUsdsDeposit({
  amount,
  referral = 0,
  enabled = true,
  ...flow
}: BatchWriteHookParams & {
  amount: bigint;
  referral?: number;
}): ApproveThenActHook {
  const { address } = useConnection();
  const chainId = useChainId();
  const { data: allowance, error: allowanceError } = useStUsdsAllowance();

  const usds = usdsAddress[chainId as keyof typeof usdsAddress];
  const stUsds = stUsdsAddress[chainId as keyof typeof stUsdsAddress];

  return useApproveThenAct({
    ...flow,
    chainId,
    enabled: enabled && amount !== 0n,
    legs: [
      {
        approve: { token: usds, spender: stUsds, amount, allowance, allowanceError },
        calls: [
          getWriteContractCall({
            to: stUsds,
            abi: stUsdsImplementationAbi as Abi,
            functionName: 'deposit',
            args: [amount, address!, ...(referral > 0 ? [referral] : [])] as const
          })
        ]
      }
    ]
  });
}
