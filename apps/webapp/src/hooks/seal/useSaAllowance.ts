import { useConnection, useChainId } from 'wagmi';
import { UseTokenAllowanceResponse, useTokenAllowance } from '../tokens/useTokenAllowance';
import { ZERO_ADDRESS } from '../constants';
import { mkrAddress, skyAddress, usdsAddress } from '../generated';
import { sealModuleAddress } from '../generated';

export function useSaMkrAllowance(address?: `0x${string}` | undefined): UseTokenAllowanceResponse {
  const { address: connectedAddress } = useConnection();
  const acct = address || connectedAddress || ZERO_ADDRESS;
  const chainId = useChainId();

  const useAllowanceResponse = useTokenAllowance({
    chainId,
    contractAddress: mkrAddress[chainId as keyof typeof mkrAddress],
    owner: acct,
    spender: sealModuleAddress[chainId as keyof typeof sealModuleAddress]
  });

  return {
    ...useAllowanceResponse,
    isLoading: useAllowanceResponse.isLoading,
    error: useAllowanceResponse.error,
    dataSources: [...useAllowanceResponse.dataSources]
  };
}

export function useSaNgtAllowance(address?: `0x${string}` | undefined): UseTokenAllowanceResponse {
  const { address: connectedAddress } = useConnection();
  const acct = address || connectedAddress || ZERO_ADDRESS;
  const chainId = useChainId();

  const useAllowanceResponse = useTokenAllowance({
    chainId,
    contractAddress: skyAddress[chainId as keyof typeof skyAddress],
    owner: acct,
    spender: sealModuleAddress[chainId as keyof typeof sealModuleAddress]
  });

  return {
    ...useAllowanceResponse,
    isLoading: useAllowanceResponse.isLoading,
    error: useAllowanceResponse.error,
    dataSources: [...useAllowanceResponse.dataSources]
  };
}

export function useSaNstAllowance(address?: `0x${string}` | undefined): UseTokenAllowanceResponse {
  const { address: connectedAddress } = useConnection();
  const acct = address || connectedAddress || ZERO_ADDRESS;
  const chainId = useChainId();

  const useAllowanceResponse = useTokenAllowance({
    chainId,
    contractAddress: usdsAddress[chainId as keyof typeof usdsAddress],
    owner: acct,
    spender: sealModuleAddress[chainId as keyof typeof sealModuleAddress]
  });

  return {
    ...useAllowanceResponse,
    isLoading: useAllowanceResponse.isLoading,
    error: useAllowanceResponse.error,
    dataSources: [...useAllowanceResponse.dataSources]
  };
}
