import { useQuery } from '@tanstack/react-query';
import { TRUST_LEVELS, TrustLevelEnum } from '../constants';
import { ReadHook } from '../hooks';
import { MORPHO_API_URL } from './constants';
import { mainnet } from 'viem/chains';

type MorphoVaultApiResponse = {
  data: {
    vaultV2ByAddress: {
      address: string;
      avgApy: number;
      avgNetApy: number;
      performanceFee: number;
      managementFee: number;
      rewards: {
        supplyApr: number;
        asset: {
          symbol: string;
          logoURI: string | null;
        };
      }[];
    } | null;
  };
};

/** Reward data for displaying incentives */
export type MorphoRewardData = {
  /** Reward APY as a decimal */
  apy: number;
  /** Formatted reward APY (e.g., "+0.26%") */
  formattedApy: string;
  /** Reward token symbol (e.g., "MORPHO") */
  symbol: string;
  /** Reward token logo URI */
  logoUri: string | null;
};

export type MorphoVaultRateData = {
  /** Native APY (before performance fee) as a decimal (e.g., 0.05 for 5%) */
  rate: number;
  /** Net APY (after performance fee, including rewards) as a decimal */
  netRate: number;
  /** Management fee as a decimal */
  managementFee: number;
  /** Performance fee as a decimal */
  performanceFee: number;
  /** Formatted APY string for display (e.g., "5.00%") */
  formattedRate: string;
  /** Formatted Net APY string for display */
  formattedNetRate: string;
  /** Formatted management fee for display (e.g., "0%") */
  formattedManagementFee: string;
  /** Formatted performance fee for display (e.g., "0%") */
  formattedPerformanceFee: string;
  /** Rewards/incentives data */
  rewards: MorphoRewardData[];
};

export type MorphoVaultRateHook = ReadHook & {
  data?: MorphoVaultRateData;
};

const VAULT_RATE_QUERY = `
  query VaultRate($address: String!, $chainId: Int!) {
    vaultV2ByAddress(address: $address, chainId: $chainId) {
      address
      avgApy
      avgNetApy
      performanceFee
      managementFee
      rewards {
        supplyApr
        asset {
          symbol
          logoURI
        }
      }
    }
  }
`;

async function fetchMorphoVaultRate(
  vaultAddress: string,
  chainId: number
): Promise<MorphoVaultRateData | undefined> {
  const response = await fetch(MORPHO_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query: VAULT_RATE_QUERY,
      variables: {
        address: vaultAddress.toLowerCase(),
        chainId
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Morpho API error: ${response.status}`);
  }

  const result: MorphoVaultApiResponse = await response.json();

  if (!result.data.vaultV2ByAddress) {
    return undefined;
  }

  const { avgApy, avgNetApy, managementFee, performanceFee, rewards } = result.data.vaultV2ByAddress;

  // Transform rewards data (supplyApr is already a decimal, e.g., 0.0026 for 0.26%)
  // Aggregate rewards by symbol and filter out 0% APY rewards
  const rewardsMap = new Map<string, { apy: number; logoUri: string | null }>();
  for (const reward of rewards || []) {
    if (reward.supplyApr > 0) {
      const existing = rewardsMap.get(reward.asset.symbol);
      if (existing) {
        existing.apy += reward.supplyApr;
      } else {
        rewardsMap.set(reward.asset.symbol, {
          apy: reward.supplyApr,
          logoUri: reward.asset.logoURI
        });
      }
    }
  }

  const rewardsData: MorphoRewardData[] = Array.from(rewardsMap.entries()).map(([symbol, data]) => ({
    apy: data.apy,
    formattedApy: `+${(data.apy * 100).toFixed(2)}%`,
    symbol,
    logoUri: data.logoUri
  }));

  return {
    rate: avgApy,
    netRate: avgNetApy,
    managementFee,
    performanceFee,
    formattedRate: `${(avgApy * 100).toFixed(2)}%`,
    formattedNetRate: `${(avgNetApy * 100).toFixed(2)}%`,
    formattedManagementFee: `${(managementFee * 100).toFixed(0)}%`,
    formattedPerformanceFee: `${(performanceFee * 100).toFixed(0)}%`,
    rewards: rewardsData
  };
}

export function useMorphoVaultRate({ vaultAddress }: { vaultAddress?: `0x${string}` }): MorphoVaultRateHook {
  // Always use mainnet chainId since Morpho vaults are only on mainnet
  // This ensures the query is cached across network switches
  const chainId = mainnet.id;

  const {
    data,
    error,
    refetch: mutate,
    isLoading
  } = useQuery({
    queryKey: ['morpho-vault-rate', vaultAddress, chainId],
    queryFn: () => fetchMorphoVaultRate(vaultAddress!, chainId),
    enabled: !!vaultAddress,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000 // 10 minutes
  });

  return {
    data,
    isLoading: !data && isLoading,
    error: error as Error | null,
    mutate,
    dataSources: [
      {
        title: 'Morpho API',
        href: 'https://api.morpho.org/graphql',
        onChain: false,
        trustLevel: TRUST_LEVELS[TrustLevelEnum.TWO]
      }
    ]
  };
}
