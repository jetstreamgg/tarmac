import { usdsAddress, stUsdsAddress } from '../generated';
import { useConnection, useChainId } from 'wagmi';
import { ReadHook } from '../hooks';
import { useTokenAllowance } from '../tokens/useTokenAllowance';
import { ZERO_ADDRESS } from '../constants';

export type StUsdsAllowanceHookResponse = ReadHook & {
  data?: bigint;
};

export function useStUsdsAllowance(address?: `0x${string}`): StUsdsAllowanceHookResponse {
  const { address: connectedAddress } = useConnection();
  const acct = address || connectedAddress || ZERO_ADDRESS;
  const chainId = useChainId();

  const useAllowanceResponse = useTokenAllowance({
    chainId,
    contractAddress: usdsAddress[chainId as keyof typeof usdsAddress],
    owner: acct,
    spender: stUsdsAddress[chainId as keyof typeof stUsdsAddress]
  });

  return {
    ...useAllowanceResponse,
    isLoading: useAllowanceResponse.isLoading,
    error: useAllowanceResponse.error,
    dataSources: [...useAllowanceResponse.dataSources]
  };
}
