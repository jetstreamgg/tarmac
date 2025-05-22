import { useAccount, useChainId } from 'wagmi';
import { StakeWriteHookParams } from './stakeModule';
import { stakeModuleAbi, stakeModuleAddress } from '../generated';
import { ZERO_ADDRESS } from '../constants';
import { getStakeDrawCalldata } from './calldata';
import { useWriteContractFlow } from '../shared/useWriteContractFlow';

export function useDrawUsds({
  index,
  to,
  gas,
  amount,
  enabled: activeTabEnabled = true,
  onStart = () => null,
  onError = () => null,
  onSuccess = () => null
}: StakeWriteHookParams & {
  index: bigint;
  to: `0x${string}`;
  amount: bigint | undefined;
}) {
  const chainId = useChainId();
  const { isConnected, address } = useAccount();

  const enabled =
    !!address && isConnected && activeTabEnabled && !!to && to !== ZERO_ADDRESS && !!amount && amount > 0n;

  const writeContractFlowData = useWriteContractFlow({
    address: stakeModuleAddress[chainId as keyof typeof stakeModuleAddress] as `0x${string}`,
    abi: stakeModuleAbi,
    functionName: 'draw',
    args: [address!, index, to, amount!],
    chainId: chainId,
    gas,
    enabled,
    onStart,
    onError,
    onSuccess
  });

  const calldata =
    !!address && !!to && !!amount
      ? getStakeDrawCalldata({
          ownerAddress: address,
          urnIndex: index,
          toAddress: to,
          amount: amount
        })
      : undefined;

  return { ...writeContractFlowData, calldata };
}
