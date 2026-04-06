import { useQuery } from '@tanstack/react-query';
import { TRUST_LEVELS, TrustLevelEnum } from '../constants';
import { ReadHook } from '../hooks';
import { MORPHO_API_URL, VAULT_MARKET_DATA_QUERY } from './constants';
import { formatBigInt, formatNumber, formatPercent } from '@jetstreamgg/sky-utils';
import { mainnet } from 'viem/chains';
import type {
  MorphoIdleLiquidityAllocation,
  MorphoMarketAllocation,
  MorphoVaultAllocationsData
} from './morpho';
import type { MorphoRewardData, MorphoVaultRateData } from './useMorphoVaultRateApiData';

/**
 * Cap item from the Morpho API. For MarketV1 caps, `data.market` contains market info.
 */
type CapItem = {
  type: string;
  data: {
    market?: {
      uniqueKey: string;
      lltv: string;
      loanAsset: { symbol: string };
      collateralAsset: { symbol: string };
      state: {
        supplyAssets: string;
        borrowAssets: string;
        utilization: number;
        netSupplyApy: number;
      };
    };
  };
  absoluteCap: number | string;
  relativeCap: string;
  /** Raw allocation amount in the smallest asset unit */
  allocation: number | string;
};

/**
 * API response type for the vault market data query using caps
 */
type MorphoVaultMarketApiResponse = {
  data: {
    vaultV2ByAddress: {
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
      totalAssets: string;
      totalAssetsUsd: number;
      totalSupply: string;
      idleAssets: number | string;
      idleAssetsUsd: number;
      liquidity: string;
      asset: {
        decimals: number;
        symbol: string;
      };
      caps: {
        items: CapItem[];
      };
    } | null;
  };
};

/**
 * Vault market data including rate and market state information
 */
export type MorphoVaultMarketData = {
  /** Rate data (APY, fees, rewards) */
  rate: MorphoVaultRateData;
  /** Market state data (liquidity, utilization, idle assets) */
  market: MorphoVaultAllocationsData;
  /** Vault-level available liquidity from the API */
  liquidity: bigint;
  /** Total assets held by the vault (in smallest asset unit) */
  totalAssets: bigint;
  /** Total assets held by the vault in USD */
  totalAssetsUsd: number;
  /** Total supply of vault shares */
  totalSupply: bigint;
};

export type MorphoVaultMarketDataHook = ReadHook & {
  data?: MorphoVaultMarketData;
};

/**
 * Fetch vault market data (rate + allocations) using the caps query.
 * This replaces both single-market and multi-market fetch functions by using
 * the vault's caps field which includes all market allocations from the API.
 */
export async function fetchMorphoVaultMarketData(
  vaultAddress: string,
  chainId: number
): Promise<MorphoVaultMarketData | undefined> {
  const response = await fetch(MORPHO_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query: VAULT_MARKET_DATA_QUERY,
      variables: {
        address: vaultAddress.toLowerCase(),
        chainId
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Morpho API error: ${response.status}`);
  }

  const result: MorphoVaultMarketApiResponse = await response.json();

  if (!result.data.vaultV2ByAddress) {
    return undefined;
  }

  const vault = result.data.vaultV2ByAddress;

  // --- Process rate data ---
  const { apy, netApy, managementFee, performanceFee, rewards } = vault;

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
    address: vaultAddress,
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

  // --- Process allocation data ---
  const { totalAssets, totalAssetsUsd, totalSupply, idleAssets, idleAssetsUsd, asset } = vault;
  const assetDecimals = asset.decimals;
  const assetSymbol = asset.symbol;

  // Idle liquidity directly from the API
  const idleLiquidity: MorphoIdleLiquidityAllocation[] = [
    {
      assetSymbol,
      formattedAssets: formatBigInt(BigInt(idleAssets), { unit: assetDecimals, compact: true }),
      formattedAssetsUsd: `$${formatNumber(idleAssetsUsd, { compact: true })}`,
      idleAssetsUsd
    }
  ];

  // Filter caps to MarketV1 type and build market allocations
  const marketV1Caps = vault.caps.items.filter(cap => cap.type === 'MarketV1' && cap.data.market);

  // Price per smallest asset unit (used to convert raw allocation to USD)
  const assetPriceUsd = totalAssetsUsd > 0 ? totalAssetsUsd / Number(totalAssets) : 0;

  const markets: MorphoMarketAllocation[] = [];

  for (const cap of marketV1Caps) {
    const market = cap.data.market!;
    const totalSupplyAssets = BigInt(market.state.supplyAssets);
    const totalBorrowAssets = BigInt(market.state.borrowAssets);
    const liquidity = totalSupplyAssets - totalBorrowAssets;

    // allocation is a raw amount in the smallest asset unit
    const vaultAssets = BigInt(cap.allocation);
    const vaultAssetsUsd = Number(vaultAssets) * assetPriceUsd;

    // Absolute cap
    const absoluteCapBigInt = BigInt(cap.absoluteCap);
    // If the cap is unreasonably large (>10^30), treat it as unlimited
    const isUnlimitedAbsCap = absoluteCapBigInt > 10n ** 30n;
    const formattedAbsoluteCap = isUnlimitedAbsCap
      ? 'Unlimited'
      : formatBigInt(absoluteCapBigInt, { unit: assetDecimals, compact: true });
    const absoluteCapUtilization =
      isUnlimitedAbsCap || absoluteCapBigInt === 0n ? 0 : Number(vaultAssets) / Number(absoluteCapBigInt);

    // Relative cap (WAD value: 1e18 = 100%)
    const relativeCapWad = BigInt(cap.relativeCap);
    const formattedRelativeCap = formatPercent(relativeCapWad, {
      maxDecimals: 0,
      showPercentageDecimals: false
    });
    const totalAssetsNum = Number(totalAssets);
    const relativeCapDecimal = Number(relativeCapWad) / 1e18;
    const relativeCapUtilization =
      totalAssetsNum > 0 && relativeCapDecimal > 0
        ? Number(vaultAssets) / totalAssetsNum / relativeCapDecimal
        : 0;

    markets.push({
      marketId: market.uniqueKey,
      marketUniqueKey: market.uniqueKey,
      loanAsset: market.loanAsset.symbol,
      collateralAsset: market.collateralAsset.symbol,
      formattedAssets: formatBigInt(vaultAssets, { unit: assetDecimals, compact: true }),
      formattedAssetsUsd: `$${formatNumber(vaultAssetsUsd, { compact: true })}`,
      formattedNetApy: `${(market.state.netSupplyApy * 100).toFixed(2)}%`,
      totalSupplyAssets,
      totalBorrowAssets,
      liquidity,
      utilization: market.state.utilization,
      lltv: BigInt(market.lltv),
      formattedLltv: formatPercent(BigInt(market.lltv), {
        maxDecimals: 0,
        showPercentageDecimals: false
      }),
      formattedAbsoluteCap,
      absoluteCapUtilization: Math.min(absoluteCapUtilization, 1),
      formattedRelativeCap,
      relativeCapUtilization: Math.min(relativeCapUtilization, 1)
    });
  }

  // Sort markets by allocation (highest first)
  markets.sort((a, b) => {
    const aCap = marketV1Caps.find(c => c.data.market!.uniqueKey === a.marketId);
    const bCap = marketV1Caps.find(c => c.data.market!.uniqueKey === b.marketId);
    return Number(BigInt(bCap?.allocation ?? 0) - BigInt(aCap?.allocation ?? 0));
  });

  const allocationsData: MorphoVaultAllocationsData = {
    v1Vaults: [],
    markets,
    idleLiquidity,
    assetSymbol
  };

  return {
    rate: rateData,
    market: allocationsData,
    liquidity: BigInt(vault.liquidity),
    totalAssets: BigInt(totalAssets),
    totalAssetsUsd,
    totalSupply: BigInt(totalSupply)
  };
}

/**
 * Hook for fetching Morpho vault data (rate + market allocations) from the Morpho API.
 *
 * Uses the vault's caps field to discover all market allocations in a single API query,
 * filtering to MarketV1 cap types. This eliminates the need for separate market queries
 * or on-chain adapter reads.
 *
 * Replaces both useMorphoVaultSingleMarketApiData and useMorphoVaultMultiMarketApiData.
 *
 * @param vaultAddress - The Morpho V2 vault contract address (optional)
 */
export function useMorphoVaultMarketApiData({
  vaultAddress
}: {
  vaultAddress?: `0x${string}`;
}): MorphoVaultMarketDataHook {
  // Always use mainnet chainId since the Morpho API only has mainnet data
  const chainId = mainnet.id;

  const {
    data,
    error,
    refetch: mutate,
    isLoading
  } = useQuery({
    queryKey: ['morpho-vault-market-data', vaultAddress, chainId],
    queryFn: () => {
      if (!vaultAddress) {
        throw new Error('Vault address is required');
      }
      return fetchMorphoVaultMarketData(vaultAddress, chainId);
    },
    enabled: !!vaultAddress,
    staleTime: 30_000, // 30 seconds - liquidity data can change frequently
    gcTime: 60_000 // 1 minute
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
