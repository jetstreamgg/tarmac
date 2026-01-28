import { useQuery } from '@tanstack/react-query';
import { TRUST_LEVELS, TrustLevelEnum } from '../constants';
import { ReadHook } from '../hooks';
import { MORPHO_API_URL, VAULT_DATA_QUERY, getMorphoVaultByAddress } from './constants';
import { formatBigInt, formatNumber, formatPercent } from '@jetstreamgg/sky-utils';
import { mainnet } from 'viem/chains';
import type {
  MorphoIdleLiquidityAllocation,
  MorphoMarketAllocation,
  MorphoVaultAllocationsData
} from './morpho';
import type { MorphoRewardData, MorphoVaultRateData } from './useMorphoVaultRateApiData';

/**
 * API response type for the single market vault data query
 */
type MorphoVaultSingleMarketApiResponse = {
  data: {
    vaultV2ByAddress: {
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
      totalAssets: string;
      totalAssetsUsd: number;
      idleAssetsUsd: number;
      asset: {
        decimals: number;
        symbol: string;
      };
    } | null;
    marketByUniqueKey: {
      uniqueKey: string;
      lltv: string;
      loanAsset: {
        symbol: string;
      };
      collateralAsset: {
        symbol: string;
      };
      state: {
        supplyAssets: string;
        borrowAssets: string;
        utilization: number;
        avgNetSupplyApy: number;
      };
    } | null;
  };
};

/**
 * Single market vault data including rate and market state information
 */
export type MorphoVaultSingleMarketData = {
  /** Rate data (APY, fees, rewards) */
  rate: MorphoVaultRateData;
  /** Market state data (liquidity, utilization, idle assets) */
  market: MorphoVaultAllocationsData;
};

export type MorphoVaultSingleMarketDataHook = ReadHook & {
  data?: MorphoVaultSingleMarketData;
};

/**
 * Fetch single market vault data (rate + allocations) in a single API call
 */
async function fetchMorphoVaultSingleMarketData(
  vaultAddress: string,
  marketId: string,
  chainId: number
): Promise<MorphoVaultSingleMarketData | undefined> {
  const response = await fetch(MORPHO_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query: VAULT_DATA_QUERY,
      variables: {
        vaultAddress: vaultAddress.toLowerCase(),
        marketId,
        chainId
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Morpho API error: ${response.status}`);
  }

  const result: MorphoVaultSingleMarketApiResponse = await response.json();

  if (!result.data.vaultV2ByAddress) {
    return undefined;
  }

  const vault = result.data.vaultV2ByAddress;
  const market = result.data.marketByUniqueKey;

  // Process rate data
  const { avgApy, avgNetApy, managementFee, performanceFee, rewards } = vault;

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

  const rateData: MorphoVaultRateData = {
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

  // Process allocation data
  const { totalAssets, totalAssetsUsd, idleAssetsUsd, asset } = vault;
  const assetDecimals = asset.decimals;
  const assetSymbol = asset.symbol;

  // Calculate idle liquidity
  const idleAssets =
    idleAssetsUsd > 0 && totalAssetsUsd > 0
      ? (BigInt(totalAssets) * BigInt(Math.round(idleAssetsUsd * 1e6))) /
        BigInt(Math.round(totalAssetsUsd * 1e6))
      : BigInt(0);

  const idleLiquidity: MorphoIdleLiquidityAllocation[] = [
    {
      assetSymbol,
      formattedAssets: formatBigInt(idleAssets, { unit: assetDecimals, compact: true }),
      formattedAssetsUsd: `$${formatNumber(idleAssetsUsd, { compact: true })}`
    }
  ];

  // Process market data
  const markets: MorphoMarketAllocation[] = [];

  if (market) {
    const totalSupplyAssets = BigInt(market.state.supplyAssets);
    const totalBorrowAssets = BigInt(market.state.borrowAssets);
    const liquidity = totalSupplyAssets - totalBorrowAssets;

    // The vault's totalAssets represents how much is allocated to this market
    const vaultAssets = BigInt(totalAssets);
    const vaultAssetsUsd = totalAssetsUsd - idleAssetsUsd; // Subtract idle from total

    markets.push({
      marketId: market.uniqueKey,
      marketUniqueKey: market.uniqueKey,
      loanAsset: market.loanAsset.symbol,
      collateralAsset: market.collateralAsset.symbol,
      formattedAssets: formatBigInt(vaultAssets, { unit: assetDecimals, compact: true }),
      formattedAssetsUsd: `$${formatNumber(vaultAssetsUsd, { compact: true })}`,
      formattedNetApy: `${(market.state.avgNetSupplyApy * 100).toFixed(2)}%`,
      totalSupplyAssets,
      totalBorrowAssets,
      liquidity,
      utilization: market.state.utilization,
      lltv: BigInt(market.lltv),
      formattedLltv: formatPercent(BigInt(market.lltv), {
        maxDecimals: 0,
        showPercentageDecimals: false
      })
    });
  }

  const allocationsData: MorphoVaultAllocationsData = {
    v1Vaults: [],
    markets,
    idleLiquidity,
    assetSymbol
  };

  return {
    rate: rateData,
    market: allocationsData
  };
}

/**
 * Hook for fetching Morpho vault data (rate + single market) from the Morpho API.
 *
 * This is an optimized hook that replaces the need to call both useMorphoVaultRateApiData
 * and useMorphoVaultAllocations separately. It uses a hardcoded market ID for the
 * vault's primary allocation, eliminating the need for on-chain adapter discovery.
 *
 * Note: This hook only works for vaults with a single market allocation configured
 * in MORPHO_VAULTS with a marketId.
 *
 * @param vaultAddress - The Morpho V2 vault contract address (optional)
 */
export function useMorphoVaultSingleMarketApiData({
  vaultAddress
}: {
  vaultAddress?: `0x${string}`;
}): MorphoVaultSingleMarketDataHook {
  // Always use mainnet chainId since the Morpho API only has mainnet data
  // This ensures the query is cached across network switches
  const chainId = mainnet.id;
  const vaultConfig = vaultAddress ? getMorphoVaultByAddress(vaultAddress, chainId) : undefined;

  const {
    data,
    error,
    refetch: mutate,
    isLoading
  } = useQuery({
    queryKey: ['morpho-vault-single-market-data', vaultAddress, chainId],
    queryFn: () => {
      if (!vaultAddress || !vaultConfig?.marketId) {
        throw new Error(`Vault ${vaultAddress} not found in MORPHO_VAULTS configuration or missing marketId`);
      }
      return fetchMorphoVaultSingleMarketData(vaultAddress, vaultConfig.marketId, chainId);
    },
    enabled: !!vaultAddress && !!vaultConfig?.marketId,
    staleTime: 30_000, // 30 seconds - liquidity data can change frequently
    gcTime: 60_000 // 1 minute
  });

  // Surface a clear error when vault isn't configured (query won't run in this case)
  const configError =
    vaultAddress && !vaultConfig?.marketId && !isLoading
      ? new Error(`Vault ${vaultAddress} not found in MORPHO_VAULTS configuration or missing marketId`)
      : null;

  return {
    data,
    isLoading: !data && isLoading,
    error: (error as Error | null) || configError,
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
