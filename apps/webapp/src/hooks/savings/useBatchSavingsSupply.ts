import { useConnection, useChainId } from 'wagmi';
import { BatchWriteHookParams } from '../hooks';
import { useSavingsAllowance } from './useSavingsAllowance';
import { sUsdsAddress, sUsdsImplementationAbi } from './useReadSavingsUsds';
import { getWriteContractCall } from '../shared/getWriteContractCall';
import { usdsAddress } from '../generated';
import { ApproveThenActHook, useApproveThenAct } from '../shared/useApproveThenAct';

/** Mainnet USDS → sUSDS: optional approve → `deposit(amount, user, ref)`. */
export function useBatchSavingsSupply({
  amount,
  ref = 0,
  enabled = true,
  ...flow
}: BatchWriteHookParams & {
  amount: bigint;
  ref?: number;
}): ApproveThenActHook {
  const { address } = useConnection();
  const chainId = useChainId();
  const { data: allowance, error: allowanceError } = useSavingsAllowance();

  const usds = usdsAddress[chainId as keyof typeof usdsAddress];
  const sUsds = sUsdsAddress[chainId as keyof typeof sUsdsAddress];

  return useApproveThenAct({
    ...flow,
    chainId,
    enabled: enabled && amount !== 0n,
    legs: [
      {
        approve: { token: usds, spender: sUsds, amount, allowance, allowanceError },
        calls: [
          getWriteContractCall({
            to: sUsds,
            abi: sUsdsImplementationAbi,
            functionName: 'deposit',
            args: [amount, address!, ref]
          })
        ]
      }
    ]
  });
}
