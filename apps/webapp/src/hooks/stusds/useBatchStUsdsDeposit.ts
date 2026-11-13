import { useConnection, useChainId } from 'wagmi';
import { BatchWriteHook, BatchWriteHookParams } from '../hooks';
import { stUsdsAddress, stUsdsImplementationAbi, usdsAddress } from '../generated';
import { Call, erc20Abi } from 'viem';
import { useStUsdsAllowance } from './useStUsdsAllowance';
import { getWriteContractCall } from '../shared/getWriteContractCall';
import { useBatchWriteFlow } from '../shared/useBatchWriteFlow';

export function useBatchStUsdsDeposit({
  amount,
  onMutate = () => null,
  onSuccess = () => null,
  onError = () => null,
  onStart = () => null,
  enabled: activeTabEnabled = true,
  shouldUseBatch = true,
  referral = 0
}: BatchWriteHookParams & {
  amount: bigint;
  referral?: number;
}): BatchWriteHook {
  const { address: connectedAddress, isConnected } = useConnection();
  const chainId = useChainId();
  const { data: allowance, error: allowanceError } = useStUsdsAllowance();

  const hasAllowance = allowance !== undefined && allowance >= amount;

  // Calls for the batch transaction
  const approveCall = getWriteContractCall({
    to: usdsAddress[chainId as keyof typeof usdsAddress],
    abi: erc20Abi,
    functionName: 'approve',
    args: [stUsdsAddress[chainId as keyof typeof stUsdsAddress], amount]
  });

  const depositCall = getWriteContractCall({
    to: stUsdsAddress[chainId as keyof typeof stUsdsAddress],
    abi: stUsdsImplementationAbi,
    functionName: 'deposit',
    // Always the 3-arg overload, so every deposit emits a referral code — the
    // 2-arg form emits none, which left deposits unattributed while the
    // configured code was 0 (APP-322).
    args: [amount, connectedAddress!, referral]
  });

  const calls: Call[] = [];
  if (!hasAllowance) calls.push(approveCall);
  calls.push(depositCall);

  const enabled =
    isConnected &&
    !!amount &&
    amount !== 0n &&
    allowance !== undefined &&
    activeTabEnabled &&
    !!connectedAddress;

  return useBatchWriteFlow({
    calls,
    chainId,
    enabled,
    shouldUseBatch,
    onMutate,
    onSuccess,
    onError,
    onStart,
    allowanceError: allowanceError
  });
}
