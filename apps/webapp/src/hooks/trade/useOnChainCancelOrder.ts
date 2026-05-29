import { useConnection, useChainId } from 'wagmi';
import { WriteHookParams } from '../hooks';
import { gPv2SettlementAbi, gPv2SettlementAddress } from '../generated';
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
  const { address: connectedAddress, isConnected } = useConnection();
  const chainId = useChainId();

  // Only enabled if there is an order UID
  const enabled = paramEnabled && isConnected && !!connectedAddress && !!orderUid;

  return useWriteContractFlow({
    address: gPv2SettlementAddress[chainId as keyof typeof gPv2SettlementAddress],
    abi: gPv2SettlementAbi,
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
