import { useConnection, useChainId } from 'wagmi';
import { WriteHook, WriteHookParams } from '../hooks';
import { useStUsdsData } from './useStUsdsData';
import { stUsdsAddress, stUsdsImplementationAbi } from '../generated';
import { useWriteContractFlow } from '../shared/useWriteContractFlow';

export function useStUsdsWithdraw({
  amount,
  gas,
  onMutate = () => null,
  onSuccess = () => null,
  onError = () => null,
  onStart = () => null,
  enabled: activeTabEnabled = true,
  max = false
}: WriteHookParams & {
  amount: bigint;
  max?: boolean;
}): WriteHook {
  const { address: connectedAddress, isConnected } = useConnection();
  const chainId = useChainId();
  const { data: stUsdsData } = useStUsdsData();

  // For max withdrawals, use redeem with shares to avoid dust from rate changes.
  // For partial withdrawals, use withdraw with the specified asset amount.
  // Note: When liquidity is constrained, Curve is used instead of this hook.
  const operationAmount = max
    ? (stUsdsData?.userStUsdsBalance ?? 0n) // redeem uses shares
    : amount; // withdraw uses assets

  const maxRedeemAssets = stUsdsData?.userSuppliedUsds ?? 0n;

  const enabled =
    isConnected &&
    !!stUsdsData &&
    activeTabEnabled &&
    !!connectedAddress &&
    operationAmount > 0n &&
    (max
      ? stUsdsData.userMaxWithdrawBuffered >= maxRedeemAssets
      : stUsdsData.userMaxWithdrawBuffered >= amount);

  return useWriteContractFlow({
    address: stUsdsAddress[chainId as keyof typeof stUsdsAddress],
    abi: stUsdsImplementationAbi,
    functionName: max ? 'redeem' : 'withdraw',
    args: [operationAmount, connectedAddress!, connectedAddress!] as const,
    chainId,
    gas,
    enabled,
    onMutate,
    onSuccess,
    onError,
    onStart
  });
}
