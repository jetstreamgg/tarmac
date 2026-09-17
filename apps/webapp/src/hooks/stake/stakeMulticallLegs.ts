import { Call, ContractFunctionArgs, ContractFunctionName, decodeFunctionData } from 'viem';
import { skyAddress, stakeModuleAbi, stakeModuleAddress, usdsAddress } from '../generated';
import { getWriteContractCall } from '../shared/getWriteContractCall';
import type { ApproveThenActLeg } from '../shared/useApproveThenAct';

/**
 * The stake module's write as engine legs: approve(SKY) → approve(USDS) → the
 * calldata. One entry is decoded and sent directly; several go out as
 * individual calls in one EIP-5792 bundle, or sequentially as one `multicall`.
 * Empty off mainnet: an undefined target throws from viem the moment anything
 * encodes the calls (Sentry WEBAPP-E4).
 */
export function stakeMulticallLegs({
  chainId,
  calldata,
  skyAmount,
  usdsAmount,
  skyAllowance,
  usdsAllowance,
  shouldUseBatch
}: {
  chainId: number;
  calldata: `0x${string}`[] | undefined;
  skyAmount: bigint;
  usdsAmount: bigint;
  skyAllowance: { allowance: bigint | undefined; allowanceError?: Error | null };
  usdsAllowance: { allowance: bigint | undefined; allowanceError?: Error | null };
  shouldUseBatch: boolean;
}): ApproveThenActLeg[] {
  const stakeModule = stakeModuleAddress[chainId as keyof typeof stakeModuleAddress];
  if (!calldata?.length || !stakeModule) return [];

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

  return [
    {
      approve: {
        token: skyAddress[chainId as keyof typeof skyAddress],
        spender: stakeModule,
        amount: skyAmount,
        ...skyAllowance
      },
      calls: []
    },
    {
      approve: {
        token: usdsAddress[chainId as keyof typeof usdsAddress],
        spender: stakeModule,
        amount: usdsAmount,
        ...usdsAllowance
      },
      calls: actions
    }
  ];
}
