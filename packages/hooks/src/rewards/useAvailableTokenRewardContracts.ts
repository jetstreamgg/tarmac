import { useMemo, useCallback } from 'react';
import { RewardContract } from './rewards';
import { cleRewardAddress, usdsSpkRewardAddress, usdsSkyRewardAddress } from '../generated';
import { TOKENS } from '../tokens/tokens.constants';

const REWARD_CONTRACT_CONFIGS = [
  {
    supplyToken: TOKENS.usds,
    rewardToken: TOKENS.sky,
    getAddress: (chainId: number) => usdsSkyRewardAddress[chainId as keyof typeof usdsSkyRewardAddress],
    name: 'With: USDS Get: SKY',
    description: 'Supply USDS, get SKY',
    externalLink: 'https://usds.sky',
    logo: 'https://via.placeholder.com/400x400/04d19a/ffffff?text=SKY',
    featured: true
  },
  {
    supplyToken: TOKENS.usds,
    rewardToken: TOKENS.spk,
    getAddress: (chainId: number) => usdsSpkRewardAddress[chainId as keyof typeof usdsSpkRewardAddress],
    name: 'With: USDS Get: SPK',
    description: 'Supply USDS, get SPK',
    externalLink: 'http://spark.fi/',
    logo: 'https://via.placeholder.com/400x400/04d19a/9CD33B?text=SPK'
  },
  {
    supplyToken: TOKENS.usds,
    rewardToken: TOKENS.cle,
    getAddress: (chainId: number) => cleRewardAddress[chainId as keyof typeof cleRewardAddress],
    name: 'Chronicle Points',
    description: 'Supply USDS, get CLE',
    externalLink: 'https://usds.sky',
    logo: 'https://via.placeholder.com/400x400/04d19a/9CD33B?text=CLE'
  }
] as const;

// Helper function to create reward contracts for a specific chain
const createRewardContracts = (chainId: number): RewardContract[] => {
  return REWARD_CONTRACT_CONFIGS.map(config => ({
    ...config,
    contractAddress: config.getAddress(chainId),
    chainId
  }));
};

export function useAvailableTokenRewardContracts(chainId: number) {
  return useMemo(() => createRewardContracts(chainId), [chainId]);
}

export function useAvailableTokenRewardContractsForChains() {
  const allContracts = useMemo(() => {
    const contracts: Record<number, RewardContract[]> = {};

    Object.keys(usdsSkyRewardAddress).forEach(chainId => {
      const numChainId = Number(chainId);
      contracts[numChainId] = createRewardContracts(numChainId);
    });

    return contracts;
  }, []);

  return useCallback(
    (chainId: number) => {
      return allContracts[chainId] ?? [];
    },
    [allContracts]
  );
}
