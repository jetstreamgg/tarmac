import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useChainId, useConnection } from 'wagmi';
import { isTestnetId } from '@jetstreamgg/sky-utils';
import { mainnet } from 'viem/chains';
import { TRUST_LEVELS, TrustLevelEnum } from '../constants';
import { ReadHook } from '../hooks';
import { MERKL_API_URL, MORPHO_VAULTS } from './constants';
import { MorphoVaultConfig } from './morpho';
import {
  fetchMerklRewards,
  processMerklRewardsForVault,
  MorphoVaultRewardsData
} from './useMorphoVaultRewards';

export type MorphoVaultAllRewardsEntry = {
  vaultConfig: MorphoVaultConfig;
  vaultAddress: `0x${string}`;
  rewardsData: MorphoVaultRewardsData;
};

export type MorphoVaultAllRewardsHook = ReadHook & {
  data: MorphoVaultAllRewardsEntry[];
};

/**
 * Hook that fetches Merkl rewards once for the connected user and processes
 * them for all configured Morpho vaults. Uses the same Merkl API endpoint
 * as useMorphoVaultRewards but avoids redundant API calls by fetching once
 * and filtering client-side for each vault.
 */
export function useMorphoVaultAllRewards(): MorphoVaultAllRewardsHook {
  const { address: userAddress } = useConnection();
  const connectedChainId = useChainId();
  const chainId = isTestnetId(connectedChainId) ? mainnet.id : connectedChainId;

  const {
    data: merklData,
    error,
    refetch: mutate,
    isLoading
  } = useQuery({
    queryKey: ['merkl-rewards', userAddress, chainId],
    queryFn: () => {
      if (!userAddress) {
        throw new Error('User address not available');
      }
      return fetchMerklRewards(userAddress, chainId);
    },
    enabled: !!userAddress,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000
  });

  const data = useMemo(() => {
    if (!merklData) return [];

    const entries: MorphoVaultAllRewardsEntry[] = [];
    for (const vaultConfig of MORPHO_VAULTS) {
      const vaultAddress = vaultConfig.vaultAddress[chainId];
      if (!vaultAddress) continue;

      const rewardsData = processMerklRewardsForVault(merklData, vaultAddress, chainId);
      if (rewardsData.hasClaimableRewards) {
        entries.push({ vaultConfig, vaultAddress, rewardsData });
      }
    }

    return entries;
  }, [merklData, chainId]);

  return {
    data,
    isLoading: !merklData && isLoading,
    error: error as Error | null,
    mutate,
    dataSources: [
      {
        title: 'Merkl API',
        href: MERKL_API_URL,
        onChain: false,
        trustLevel: TRUST_LEVELS[TrustLevelEnum.TWO]
      }
    ]
  };
}
