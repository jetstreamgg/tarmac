import { useAccount, useChainId } from 'wagmi';
import { WriteHookParams } from '../hooks';
import {
  gPv2SettlementAbi,
  gPv2SettlementAddress,
  gPv2SettlementSepoliaAbi,
  gPv2SettlementSepoliaAddress
} from '../generated';
import { sepolia } from 'viem/chains';
import { useWriteContractFlow } from '../shared/useWriteContractFlow';

export const useOnChainCancelOrder = ({
  orderUid,
  gas,
  enabled: paramEnabled = true,
  onMutate = () => null,
  onStart = () => null,
  onSuccess = () => null,
  onError = () => null
}: WriteHookParams & {
  orderUid: `0x${string}` | undefined;
}) => {
  const { address: connectedAddress, isConnected } = useAccount();
  const chainId = useChainId();

  // Only enabled if there is an order UID
  const enabled = paramEnabled && isConnected && !!connectedAddress && !!orderUid;

  return useWriteContractFlow({
    address:
      chainId === sepolia.id
        ? gPv2SettlementSepoliaAddress[chainId as keyof typeof gPv2SettlementSepoliaAddress]
        : gPv2SettlementAddress[chainId as keyof typeof gPv2SettlementAddress],
    abi: chainId === sepolia.id ? gPv2SettlementSepoliaAbi : gPv2SettlementAbi,
    functionName: 'setPreSignature',
    args: [orderUid!, false],
    chainId,
    gas,
    enabled,
    onMutate,
    onSuccess,
    onError,
    onStart
  });
};
