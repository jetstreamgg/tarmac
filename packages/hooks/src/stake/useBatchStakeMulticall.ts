import { useConnection, useChainId } from 'wagmi';
import { BatchWriteHook, BatchWriteHookParams } from '../hooks';
import { skyAddress, stakeModuleAbi, stakeModuleAddress, usdsAddress } from '../generated';
import { useStakeSkyAllowance, useStakeUsdsAllowance } from './useStakeAllowance';
import { getWriteContractCall } from '../shared/getWriteContractCall';
import { Call, ContractFunctionArgs, ContractFunctionName, decodeFunctionData, erc20Abi } from 'viem';
import { useTransactionFlow } from '../shared/useTransactionFlow';

export function useBatchStakeMulticall({
  skyAmount,
  usdsAmount,
  enabled: paramEnabled = true,
  shouldUseBatch = true,
  onMutate = () => null,
  onStart = () => null,
  onError = () => null,
  onSuccess = () => null,
  calldata
}: BatchWriteHookParams & {
  calldata: `0x${string}`[] | undefined;
  skyAmount: bigint;
  usdsAmount: bigint;
}): BatchWriteHook {
  const chainId = useChainId();
  const { isConnected } = useConnection();

  const { data: skyAllowance, error: skyAllowanceError } = useStakeSkyAllowance();
  const { data: usdsAllowance, error: usdsAllowanceError } = useStakeUsdsAllowance();

  const hasSkyAllowance = skyAllowance !== undefined && skyAllowance >= skyAmount;
  const hasUsdsAllowance = usdsAllowance !== undefined && usdsAllowance >= usdsAmount;

  // Calls for the batch transaction
  const calls: Call[] = [];
  if (calldata?.length) {
    const approveSkyCall = getWriteContractCall({
      to: skyAddress[chainId as keyof typeof skyAddress],
      abi: erc20Abi,
      functionName: 'approve',
      args: [stakeModuleAddress[chainId as keyof typeof stakeModuleAddress], skyAmount]
    });

    const approveUsdsCall = getWriteContractCall({
      to: usdsAddress[chainId as keyof typeof usdsAddress],
      abi: erc20Abi,
      functionName: 'approve',
      args: [stakeModuleAddress[chainId as keyof typeof stakeModuleAddress], usdsAmount]
    });

    // Individual transaction using `multicall`
    const multicallCall = getWriteContractCall({
      to: stakeModuleAddress[chainId as keyof typeof stakeModuleAddress],
      abi: stakeModuleAbi,
      functionName: 'multicall',
      args: [calldata]
    });

    // Array of individual transactions, intended to be used in a batch transaction
    const individualCalls: Call[] = calldata.map(data => ({
      to: stakeModuleAddress[chainId as keyof typeof stakeModuleAddress],
      data
    }));

    if (!hasSkyAllowance) calls.push(approveSkyCall);
    if (!hasUsdsAllowance) calls.push(approveUsdsCall);

    // If the calldata array only has 1 element, decode that call and send it individually
    if (calldata.length === 1) {
      const decodedSingleCalldata = decodeFunctionData({
        abi: stakeModuleAbi,
        data: calldata[0]
      });
      const singleCall = getWriteContractCall({
        to: stakeModuleAddress[chainId as keyof typeof stakeModuleAddress],
        abi: stakeModuleAbi,
        functionName: decodedSingleCalldata.functionName as ContractFunctionName<
          typeof stakeModuleAbi,
          'nonpayable' | 'payable'
        >,
        args: decodedSingleCalldata.args as ContractFunctionArgs<
          typeof stakeModuleAbi,
          'nonpayable' | 'payable',
          ContractFunctionName<typeof stakeModuleAbi, 'nonpayable' | 'payable'>
        >
      });
      calls.push(singleCall);
      // If the user wallet supports it and user has batch tx enabled, send the calls individually
      // in a batch tx for optimized gas consumption and improved transaction readability
    } else if (shouldUseBatch) {
      calls.push(...individualCalls);
    } else calls.push(multicallCall);
  }

  const enabled =
    isConnected &&
    paramEnabled &&
    skyAllowance !== undefined &&
    usdsAllowance !== undefined &&
    !!calldata?.length;

  const transactionFlowResults = useTransactionFlow({
    calls,
    chainId,
    enabled,
    shouldUseBatch,
    onMutate,
    onSuccess,
    onError,
    onStart
  });

  return {
    ...transactionFlowResults,
    error: transactionFlowResults.error || skyAllowanceError || usdsAllowanceError
  };
}
