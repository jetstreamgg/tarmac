import { useConnection, useChainId } from 'wagmi';
import { BatchWriteHookParams } from '../hooks';
import { useSavingsAllowance } from './useSavingsAllowance';
import { sUsdsAddress, sUsdsImplementationAbi } from './useReadSavingsUsds';
import { getWriteContractCall } from '../shared/getWriteContractCall';
import { daiUsdsAbi, daiUsdsAddress, mcdDaiAddress, usdsAddress } from '../generated';
import { useTokenAllowance } from '../tokens/useTokenAllowance';
import { ApproveThenActHook, useApproveThenAct } from '../shared/useApproveThenAct';

/**
 * Mainnet DAI → sUSDS in one flow: optional approve-DAI → `daiToUsds` →
 * optional approve-USDS → `deposit`. Up to four sequential transactions, or
 * one EIP-5792 bundle.
 */
export function useBatchUpgradeAndSavingsSupply({
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

  const dai = mcdDaiAddress[chainId as keyof typeof mcdDaiAddress];
  const daiUsds = daiUsdsAddress[chainId as keyof typeof daiUsdsAddress];
  const usds = usdsAddress[chainId as keyof typeof usdsAddress];
  const sUsds = sUsdsAddress[chainId as keyof typeof sUsdsAddress];

  const { data: daiAllowance, error: daiAllowanceError } = useTokenAllowance({
    chainId,
    contractAddress: dai,
    owner: address,
    spender: daiUsds
  });
  const { data: usdsAllowance, error: usdsAllowanceError } = useSavingsAllowance();

  return useApproveThenAct({
    ...flow,
    chainId,
    enabled: enabled && amount !== 0n,
    legs: [
      {
        approve: {
          token: dai,
          spender: daiUsds,
          amount,
          allowance: daiAllowance,
          allowanceError: daiAllowanceError
        },
        calls: [
          getWriteContractCall({
            to: daiUsds,
            abi: daiUsdsAbi,
            functionName: 'daiToUsds',
            args: [address!, amount]
          })
        ]
      },
      {
        approve: {
          token: usds,
          spender: sUsds,
          amount,
          allowance: usdsAllowance,
          allowanceError: usdsAllowanceError
        },
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
