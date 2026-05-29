import { useConnection, useChainId } from 'wagmi';
import { UseTokenAllowanceResponse, useTokenAllowance } from '../tokens/useTokenAllowance';
import { ZERO_ADDRESS } from '../constants';
import { skyAddress, usdsAddress } from '../generated';
import { stakeModuleAddress } from '../generated';

export function useStakeSkyAllowance(address?: `0x${string}` | undefined): UseTokenAllowanceResponse {
  const { address: connectedAddress } = useConnection();
  const acct = address || connectedAddress || ZERO_ADDRESS;
  const chainId = useChainId();

  const useAllowanceResponse = useTokenAllowance({
    chainId,
    contractAddress: skyAddress[chainId as keyof typeof skyAddress],
    owner: acct,
    spender: stakeModuleAddress[chainId as keyof typeof stakeModuleAddress]
  });

  return {
    ...useAllowanceResponse,
    isLoading: useAllowanceResponse.isLoading,
    error: useAllowanceResponse.error,
    dataSources: [...useAllowanceResponse.dataSources]
  };
}

export function useStakeUsdsAllowance(address?: `0x${string}` | undefined): UseTokenAllowanceResponse {
  const { address: connectedAddress } = useConnection();
  const acct = address || connectedAddress || ZERO_ADDRESS;
  const chainId = useChainId();

  const useAllowanceResponse = useTokenAllowance({
    chainId,
    contractAddress: usdsAddress[chainId as keyof typeof usdsAddress],
    owner: acct,
    spender: stakeModuleAddress[chainId as keyof typeof stakeModuleAddress]
  });

  return {
    ...useAllowanceResponse,
    isLoading: useAllowanceResponse.isLoading,
    error: useAllowanceResponse.error,
    dataSources: [...useAllowanceResponse.dataSources]
  };
}
