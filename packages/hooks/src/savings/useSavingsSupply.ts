import { useAccount, useChainId } from 'wagmi';
import { WriteHook, WriteHookParams } from '../hooks';
import { useSavingsAllowance } from './useSavingsAllowance';
import { sUsdsAddress, sUsdsImplementationAbi } from './useReadSavingsUsds';
import { useWriteContractFlow } from '../shared/useWriteContractFlow';
import { TENDERLY_CHAIN_ID } from '../constants';

export function useSavingsSupply({
  amount,
  gas,
  onSuccess = () => null,
  onError = () => null,
  onStart = () => null,
  enabled: activeTabEnabled = true,
  ref = 0
}: WriteHookParams & {
  amount: bigint;
  ref?: number;
}): WriteHook {
  const { address: connectedAddress, isConnected } = useAccount();
  const chainId = useChainId();
  const { data: allowance } = useSavingsAllowance();

  // Only enabled if users allowance is GTE their supply amount and they have a proxy
  const enabled =
    isConnected &&
    !!amount &&
    amount !== 0n &&
    !!allowance &&
    allowance >= amount &&
    activeTabEnabled &&
    !!connectedAddress;

  return useWriteContractFlow({
    address: sUsdsAddress[chainId as keyof typeof sUsdsAddress],
    abi: sUsdsImplementationAbi,
    functionName: 'deposit',
    args: [amount, connectedAddress!, ref],
    chainId,
    gas: chainId === TENDERLY_CHAIN_ID ? gas || 170000n : gas, // Set gas limit for Tenderly to prevent errors due to pot.drip() not being called every block
    enabled,
    onSuccess,
    onError,
    onStart
  });
}
