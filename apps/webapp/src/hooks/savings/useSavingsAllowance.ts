import { usdsAddress } from '../generated';
import { useConnection, useChainId } from 'wagmi';
import { ReadHook } from '../hooks';
import { useTokenAllowance } from '../tokens/useTokenAllowance';
import { ZERO_ADDRESS } from '../constants';
import { sUsdsAddress } from './useReadSavingsUsds';

export type DSRAllowanceHookResponse = ReadHook & {
  data?: bigint;
};

export function useSavingsAllowance(address?: `0x${string}`): DSRAllowanceHookResponse {
  const { address: connectedAddress } = useConnection();
  const acct = address || connectedAddress || ZERO_ADDRESS;
  const chainId = useChainId();

  const useAllowanceResponse = useTokenAllowance({
    chainId,
    contractAddress: usdsAddress[chainId as keyof typeof usdsAddress],
    owner: acct,
    spender: sUsdsAddress[chainId as keyof typeof sUsdsAddress]
  });

  return {
    ...useAllowanceResponse,
    isLoading: useAllowanceResponse.isLoading,
    error: useAllowanceResponse.error,
    dataSources: [...useAllowanceResponse.dataSources]
  };
}
