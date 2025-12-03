import { useReadContracts } from 'wagmi';
import { useMemo } from 'react';
import { ReadHook } from '../hooks';
import { stakeModuleAddress, stakeModuleAbi } from '../generated';
import { useCurrentUrnIndex } from './useCurrentUrnIndex';
import { isMainnetId, chainId } from '@jetstreamgg/sky-utils';
import { useChainId } from 'wagmi';

export type UseAllStakeUrnAddressesResponse = ReadHook & {
  data: `0x${string}`[];
};

// Fetches all staking urn addresses that a user owns
export const useAllStakeUrnAddresses = (userAddress?: `0x${string}`): UseAllStakeUrnAddressesResponse => {
  const currentChainId = useChainId();
  const stakingChainId = isMainnetId(currentChainId) ? currentChainId : chainId.mainnet;

  const { data: currentUrnIndex } = useCurrentUrnIndex();
  const urnCount = Number(currentUrnIndex || 0n);

  const urnAddressContracts = useMemo(() => {
    if (!userAddress || urnCount === 0) return [];

    return Array.from(Array(urnCount).keys()).map(i => ({
      chainId: stakingChainId,
      address: stakeModuleAddress[stakingChainId as keyof typeof stakeModuleAddress],
      abi: stakeModuleAbi,
      functionName: 'ownerUrns' as const,
      args: [userAddress, BigInt(i)]
    }));
  }, [urnCount, stakingChainId, userAddress]);

  const {
    data: urnAddressResults,
    isLoading,
    error,
    refetch
  } = useReadContracts({
    contracts: urnAddressContracts,
    query: { enabled: urnAddressContracts.length > 0 }
  });

  const data = useMemo(() => {
    if (!urnAddressResults) return [];
    return urnAddressResults
      .map(result => (result.status === 'success' ? (result.result as `0x${string}`) : undefined))
      .filter((addr): addr is `0x${string}` => !!addr);
  }, [urnAddressResults]);

  return {
    data,
    isLoading,
    error,
    mutate: refetch,
    dataSources: []
  };
};
