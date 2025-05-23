import { ReadHook } from '../hooks';
import { useDelegates } from './useDelegates';
import { useChainId } from 'wagmi';
import { ZERO_ADDRESS } from '../constants';

type UseDelegateOwnerResponse = ReadHook & {
  data: `0x${string}` | undefined;
};

export function useDelegateOwner(address?: `0x${string}`): UseDelegateOwnerResponse {
  const chainId = useChainId();
  const enabled = !!address && address !== ZERO_ADDRESS;
  const {
    data: delegates,
    isLoading,
    error,
    mutate,
    dataSources
  } = useDelegates({ chainId, search: address, enabled });
  const ownerAddress = delegates?.[0]?.ownerAddress;

  return {
    data: ownerAddress,
    isLoading,
    error,
    mutate,
    dataSources
  };
}
