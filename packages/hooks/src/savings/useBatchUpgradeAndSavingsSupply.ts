import { useAccount, useChainId } from 'wagmi';
import { BatchWriteHook, BatchWriteHookParams } from '../hooks';
import { useSavingsAllowance } from './useSavingsAllowance';
import { sUsdsAddress, sUsdsImplementationAbi } from './useReadSavingsUsds';
import { getWriteContractCall } from '../shared/getWriteContractCall';
import { daiUsdsAbi, daiUsdsAddress, mcdDaiAddress, usdsAddress } from '../generated';
import { Call, erc20Abi } from 'viem';
import { useTransactionFlow } from '../shared/useTransactionFlow';
import { useTokenAllowance } from '../tokens/useTokenAllowance';

export function useBatchUpgradeAndSavingsSupply({
  amount,
  onMutate = () => null,
  onSuccess = () => null,
  onError = () => null,
  onStart = () => null,
  enabled: paramEnabled = true,
  shouldUseBatch = true,
  ref = 0
}: BatchWriteHookParams & {
  amount: bigint;
  ref?: number;
}): BatchWriteHook {
  const { address: connectedAddress, isConnected } = useAccount();
  const chainId = useChainId();

  const { data: daiUgradeAllowance } = useTokenAllowance({
    chainId,
    contractAddress: mcdDaiAddress[chainId as keyof typeof mcdDaiAddress],
    owner: connectedAddress,
    spender: daiUsdsAddress[chainId as keyof typeof daiUsdsAddress]
  });
  const { data: usdsSupplyAllowance, error: allowanceError } = useSavingsAllowance();

  const hasDaiUpgradeAllowance = daiUgradeAllowance !== undefined && daiUgradeAllowance >= amount;
  const hasUsdsSupplyAllowance = usdsSupplyAllowance !== undefined && usdsSupplyAllowance >= amount;

  // Calls for the batch transaction
  const calls: Call[] = [];

  const approveDaiCall = getWriteContractCall({
    to: mcdDaiAddress[chainId as keyof typeof mcdDaiAddress],
    abi: erc20Abi,
    functionName: 'approve',
    args: [daiUsdsAddress[chainId as keyof typeof daiUsdsAddress], amount]
  });

  const upgradeCall = getWriteContractCall({
    to: daiUsdsAddress[chainId as keyof typeof daiUsdsAddress],
    abi: daiUsdsAbi,
    functionName: 'daiToUsds',
    args: [connectedAddress!, amount]
  });

  if (!hasDaiUpgradeAllowance) calls.push(approveDaiCall);
  calls.push(upgradeCall);

  const approveUsdsCall = getWriteContractCall({
    to: usdsAddress[chainId as keyof typeof usdsAddress],
    abi: erc20Abi,
    functionName: 'approve',
    args: [sUsdsAddress[chainId as keyof typeof sUsdsAddress], amount]
  });

  const supplyCall = getWriteContractCall({
    to: sUsdsAddress[chainId as keyof typeof sUsdsAddress],
    abi: sUsdsImplementationAbi,
    functionName: 'deposit',
    args: [amount, connectedAddress!, ref]
  });

  if (!hasUsdsSupplyAllowance) calls.push(approveUsdsCall);
  calls.push(supplyCall);

  const enabled =
    isConnected &&
    !!amount &&
    amount !== 0n &&
    hasDaiUpgradeAllowance !== undefined &&
    hasUsdsSupplyAllowance !== undefined &&
    paramEnabled &&
    !!connectedAddress;

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
    error: transactionFlowResults.error || allowanceError
  };
}
