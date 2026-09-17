import { useChainId } from 'wagmi';
import { BatchWriteHookParams } from '../hooks';
import { skyAddress, stakeModuleAbi, stakeModuleAddress, usdsAddress } from '../generated';
import { useStakeSkyAllowance, useStakeUsdsAllowance } from './useStakeAllowance';
import { getWriteContractCall } from '../shared/getWriteContractCall';
import { Call, ContractFunctionArgs, ContractFunctionName, decodeFunctionData } from 'viem';
import { ApproveThenActHook, ApproveThenActLeg, useApproveThenAct } from '../shared/useApproveThenAct';

/**
 * The stake module's write: optional approve(SKY) → optional approve(USDS) →
 * the calldata. A single calldata entry is decoded and sent as a direct call;
 * several go out as individual calls inside one EIP-5792 bundle (cheaper and
 * more readable in the wallet) or, sequentially, as one `multicall`.
 */
export function useBatchStakeMulticall({
  skyAmount,
  usdsAmount,
  calldata,
  enabled = true,
  shouldUseBatch = true,
  ...flow
}: BatchWriteHookParams & {
  calldata: `0x${string}`[] | undefined;
  skyAmount: bigint;
  usdsAmount: bigint;
}): ApproveThenActHook {
  const chainId = useChainId();

  const { data: skyAllowance, error: skyAllowanceError } = useStakeSkyAllowance();
  const { data: usdsAllowance, error: usdsAllowanceError } = useStakeUsdsAllowance();

  // The stake module is mainnet-only. A wallet on another chain can still reach
  // this hook (deep link, declined auto-switch, chain changed from the wallet
  // while the flow is open), and an undefined target would throw from viem the
  // moment anything encodes the calls (Sentry WEBAPP-E4).
  const stakeModule = stakeModuleAddress[chainId as keyof typeof stakeModuleAddress];

  let legs: ApproveThenActLeg[] = [];
  if (calldata?.length && stakeModule) {
    let actions: Call[];
    if (calldata.length === 1) {
      const decoded = decodeFunctionData({ abi: stakeModuleAbi, data: calldata[0] });
      actions = [
        getWriteContractCall({
          to: stakeModule,
          abi: stakeModuleAbi,
          functionName: decoded.functionName as ContractFunctionName<
            typeof stakeModuleAbi,
            'nonpayable' | 'payable'
          >,
          args: decoded.args as ContractFunctionArgs<
            typeof stakeModuleAbi,
            'nonpayable' | 'payable',
            ContractFunctionName<typeof stakeModuleAbi, 'nonpayable' | 'payable'>
          >
        })
      ];
    } else if (shouldUseBatch) {
      actions = calldata.map(data => ({ to: stakeModule, data }));
    } else {
      actions = [
        getWriteContractCall({
          to: stakeModule,
          abi: stakeModuleAbi,
          functionName: 'multicall',
          args: [calldata]
        })
      ];
    }

    legs = [
      {
        approve: {
          token: skyAddress[chainId as keyof typeof skyAddress],
          spender: stakeModule,
          amount: skyAmount,
          allowance: skyAllowance,
          allowanceError: skyAllowanceError
        },
        calls: []
      },
      {
        approve: {
          token: usdsAddress[chainId as keyof typeof usdsAddress],
          spender: stakeModule,
          amount: usdsAmount,
          allowance: usdsAllowance,
          allowanceError: usdsAllowanceError
        },
        calls: actions
      }
    ];
  }

  return useApproveThenAct({ ...flow, chainId, enabled, shouldUseBatch, legs });
}
