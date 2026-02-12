import { useQuery } from '@tanstack/react-query';
import { TRUST_LEVELS, TrustLevelEnum } from '../constants';
import { ReadHook } from '../hooks';
import { MORPHO_API_URL } from './constants';
import { fetchBatchedVaultData } from './helpers';
import { mainnet } from 'viem/chains';

export type VaultRateRaw = {
  address: string;
  avgApy: number;
  avgNetApy: number;
  performanceFee: number;
  managementFee: number;
  totalAssetsUsd: number;
  rewards: {
    supplyApr: number;
    asset: {
      symbol: string;
      logoURI: string | null;
    };
  }[];
  liquidity: string;
  totalAssets: string;
  asset: {
    decimals: number;
    symbol: string;
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
  /** Total vault TVL in USD */
  tvlUsd: number;
  /** Rewards/incentives data */
  rewards: MorphoRewardData[];
  /** Available liquidity in the vault (native units) */
  liquidity: bigint;
  /** Total assets deposited in the vault (native units) */
  totalAssets: bigint;
  /** Decimals of the vault's underlying asset */
  assetDecimals: number;
  /** Symbol of the vault's underlying asset */
  assetSymbol: string;
};

const RATE_FIELDS = `
  address avgApy avgNetApy performanceFee managementFee totalAssetsUsd
  rewards { supplyApr asset { symbol logoURI } }
  liquidity totalAssets
  asset { decimals symbol }
`;

export function parseVaultRateData(raw: VaultRateRaw): MorphoVaultRateData {
  const { avgApy, avgNetApy, managementFee, performanceFee, totalAssetsUsd, rewards } = raw;

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
    tvlUsd: totalAssetsUsd,
    rewards: rewardsData,
    liquidity: BigInt(raw.liquidity),
    totalAssets: BigInt(raw.totalAssets),
    assetDecimals: raw.asset.decimals,
    assetSymbol: raw.asset.symbol
  };
}

export type MorphoVaultMultipleRateHook = ReadHook & {
  data?: (MorphoVaultRateData | undefined)[];
};

/**
 * Hook for fetching rate data for multiple Morpho V2 vaults.
 *
 * Fetches all vaults in a single batched request and returns an array of rate data per vault,
 * preserving the same order as the input addresses.
 *
 * @param vaultAddresses - Array of Morpho V2 vault contract addresses
 */
export function useMorphoVaultMultipleRateApiData({
  vaultAddresses
}: {
  vaultAddresses: `0x${string}`[];
}): MorphoVaultMultipleRateHook {
  const chainId = mainnet.id;

  const {
    data,
    error,
    refetch: mutate,
    isLoading
  } = useQuery({
    queryKey: ['morpho-vault-rate-multiple', ...vaultAddresses, chainId],
    queryFn: async () => {
      const results = await fetchBatchedVaultData<VaultRateRaw>(vaultAddresses, RATE_FIELDS, chainId);
      return results.map(r => (r ? parseVaultRateData(r) : undefined));
    },
    enabled: vaultAddresses.length > 0,
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
        href: MORPHO_API_URL,
        onChain: false,
        trustLevel: TRUST_LEVELS[TrustLevelEnum.TWO]
      }
    ]
  };
}
