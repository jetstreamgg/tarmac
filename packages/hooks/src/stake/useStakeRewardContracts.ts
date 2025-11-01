import request, { gql } from 'graphql-request';
import { useChainId, useConfig } from 'wagmi';
import { getMakerSubgraphUrl } from '../helpers/getSubgraphUrl';
import { useQuery } from '@tanstack/react-query';
import { TENDERLY_CHAIN_ID, TRUST_LEVELS, TrustLevelEnum } from '../constants';
import { ReadHook } from '../hooks';
import {
  stakeModuleAbi,
  stakeModuleAddress,
  lsSkyUsdsRewardAddress,
  lsSkySpkRewardAddress,
  lsSkySkyRewardAddress
} from '../generated';
import { readContracts } from '@wagmi/core';
import type { Config } from '@wagmi/core';
import { mainnet } from 'viem/chains';

// FarmStatus enum: 0 = INACTIVE, 1 = ACTIVE
const FARM_STATUS_ACTIVE = 1;

// Get hardcoded fallback reward contracts for a specific chainId (lsSky rewards)
function getHardcodedRewardContracts(chainId: number): { contractAddress: `0x${string}` }[] {
  const contracts: { contractAddress: `0x${string}` }[] = [];

  // lsSkyUsdsReward
  const usdsRewardAddr = lsSkyUsdsRewardAddress[chainId as keyof typeof lsSkyUsdsRewardAddress];
  if (usdsRewardAddr) {
    contracts.push({ contractAddress: usdsRewardAddr });
  }

  // lsSkySpkReward
  const spkRewardAddr = lsSkySpkRewardAddress[chainId as keyof typeof lsSkySpkRewardAddress];
  if (spkRewardAddr) {
    contracts.push({ contractAddress: spkRewardAddr });
  }

  // lsSkySkyReward
  const skyRewardAddr = lsSkySkyRewardAddress[chainId as keyof typeof lsSkySkyRewardAddress];
  if (skyRewardAddr) {
    contracts.push({ contractAddress: skyRewardAddr });
  }

  return contracts;
}

async function fetchStakeRewardContracts(urlSubgraph: string) {
  const query = gql`
    {
      rewards(where: { stakingEngineActive: true }) {
        id
      }
    }
  `;

  const response = await request<{ rewards: { id: `0x${string}` }[] }>(urlSubgraph, query);
  const parsedRewardContracts = response.rewards;
  if (!parsedRewardContracts) {
    return [];
  }

  return parsedRewardContracts.map(f => ({
    contractAddress: f.id
  }));
}

async function validateHardcodedContracts(config: Config, chainId: number) {
  const moduleAddress = stakeModuleAddress[chainId as keyof typeof stakeModuleAddress];
  const hardcodedContracts = getHardcodedRewardContracts(chainId);

  if (!moduleAddress || hardcodedContracts.length === 0) {
    return [];
  }

  // Query farm status for all hardcoded contracts in parallel
  const results = await readContracts(config, {
    contracts: hardcodedContracts.map(({ contractAddress }) => ({
      address: moduleAddress,
      abi: stakeModuleAbi,
      functionName: 'farms',
      args: [contractAddress],
      chainId
    }))
  });

  // Filter to only include contracts with ACTIVE status
  return hardcodedContracts.filter((_, index) => {
    const result = results[index];
    return result.status === 'success' && Number(result.result) === FARM_STATUS_ACTIVE;
  });
}

export function useStakeRewardContracts({
  subgraphUrl
}: {
  subgraphUrl?: string;
} = {}): ReadHook & { data: { contractAddress: `0x${string}` }[] | undefined } {
  const walletChainId = useChainId();
  const chainId = walletChainId === TENDERLY_CHAIN_ID ? walletChainId : mainnet.id;
  const config = useConfig();
  const urlSubgraph = subgraphUrl ? subgraphUrl : getMakerSubgraphUrl(chainId) || '';

  // Get chainId-specific hardcoded contracts for placeholder
  const hardcodedContracts = getHardcodedRewardContracts(chainId);

  // Primary query: GraphQL endpoint with hardcoded placeholder
  const {
    data: graphqlData,
    error: graphqlError,
    refetch: mutate,
    isLoading: isGraphqlLoading
  } = useQuery({
    queryKey: ['stakeRewardContracts', urlSubgraph],
    queryFn: () => fetchStakeRewardContracts(urlSubgraph),
    enabled: !!urlSubgraph,
    placeholderData: hardcodedContracts
  });

  // Fallback query: On-chain validation (only runs when GraphQL fails)
  const {
    data: validatedData,
    isLoading: isValidationLoading,
    error: validatedDataError
  } = useQuery({
    queryKey: ['stakeRewardContracts', 'validated', chainId],
    queryFn: () => validateHardcodedContracts(config, chainId),
    enabled: !!graphqlError,
    staleTime: 60000 // Cache for 1 minute
  });

  // Determine which data to return
  const data = graphqlError ? validatedData : graphqlData;
  const isLoading = graphqlError ? isValidationLoading : isGraphqlLoading;

  // Build data sources
  const dataSources = [
    {
      title: 'Sky Ecosystem subgraph',
      href: urlSubgraph,
      onChain: false,
      trustLevel: TRUST_LEVELS[TrustLevelEnum.ONE]
    }
  ];

  // Add on-chain data source if using fallback
  if (graphqlError && validatedData) {
    const moduleAddress = stakeModuleAddress[chainId as keyof typeof stakeModuleAddress];
    dataSources.push({
      title: 'StakeModule.farms (on-chain)',
      href: `https://etherscan.io/address/${moduleAddress}`,
      onChain: true,
      trustLevel: TRUST_LEVELS[TrustLevelEnum.ONE]
    });
  }

  return {
    isLoading,
    data,
    error: graphqlError ? validatedDataError : graphqlError,
    mutate,
    dataSources
  };
}
