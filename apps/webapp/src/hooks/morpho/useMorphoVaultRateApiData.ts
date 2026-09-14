import { useQuery } from '@tanstack/react-query';
import { ReadHook } from '../hooks';
import { MORPHO_API_CHAIN_ID, morphoDataSource } from './constants';
import { toReadHook } from '../shared/toReadHook';
import { morphoGraphql } from './morphoGraphql';

type MorphoVaultApiResponse = {
  data: {
    vaultV2ByAddress: {
      address: string;
      apy: number;
      netApy: number;
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
  /** Vault address */
  address: string;
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

const VAULT_RATE_QUERY = `
  query VaultRate($address: String!, $chainId: Int!) {
    vaultV2ByAddress(address: $address, chainId: $chainId) {
      address
      apy
      netApy
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
  const result = await morphoGraphql<MorphoVaultApiResponse>(VAULT_RATE_QUERY, {
    address: vaultAddress.toLowerCase(),
    chainId
  });

  if (!result.data.vaultV2ByAddress) {
    return undefined;
  }

  const { address, apy, netApy, managementFee, performanceFee, rewards } = result.data.vaultV2ByAddress;

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
    address,
    rate: apy,
    netRate: netApy,
    managementFee,
    performanceFee,
    formattedRate: `${(apy * 100).toFixed(2)}%`,
    formattedNetRate: `${(netApy * 100).toFixed(2)}%`,
    formattedManagementFee: `${(managementFee * 100).toFixed(0)}%`,
    formattedPerformanceFee: `${(performanceFee * 100).toFixed(0)}%`,
    rewards: rewardsData
  };
}

type MorphoVaultMultipleRateHook = ReadHook & {
  data?: MorphoVaultRateData[];
};

/**
 * Hook for fetching rate data for multiple Morpho V2 vaults.
 *
 * Fetches all vaults in parallel and returns an array of rate data per vault,
 * preserving the same order as the input addresses.
 *
 * @param vaultAddresses - Array of Morpho V2 vault contract addresses
 */
export function useMorphoVaultMultipleRateApiData({
  vaultAddresses
}: {
  vaultAddresses: `0x${string}`[];
}): MorphoVaultMultipleRateHook {
  const chainId = MORPHO_API_CHAIN_ID;

  const query = useQuery({
    queryKey: ['morpho-vault-rate-multiple', ...vaultAddresses, chainId],
    queryFn: () =>
      Promise.all(vaultAddresses.map(addr => fetchMorphoVaultRate(addr, chainId))).then(results =>
        results.filter((r): r is MorphoVaultRateData => r !== undefined)
      ),
    enabled: vaultAddresses.length > 0,
    staleTime: 30_000, // 30 seconds
    gcTime: 60_000 // 1 minute
  });

  return toReadHook(query, [morphoDataSource()]);
}
