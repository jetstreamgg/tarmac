import { useMemo } from 'react';
import { useChainId } from 'wagmi';
import { useReadMorphoBlueMarket, morphoBlueAddress } from '../generated';
import { TRUST_LEVELS, TrustLevelEnum } from '../constants';
import { DataSource, ReadHook } from '../hooks';
import { getEtherscanLink } from '@jetstreamgg/sky-utils';

/**
 * Data returned by the useMorphoMarketData hook
 */
export type MorphoMarketData = {
  /** Total assets supplied to the market */
  totalSupplyAssets: bigint;
  /** Total assets borrowed from the market */
  totalBorrowAssets: bigint;
  /** Available liquidity (totalSupplyAssets - totalBorrowAssets) */
  liquidity: bigint;
  /** Utilization rate as a decimal (0-1), e.g., 0.85 = 85% */
  utilization: number;
  /** Timestamp of last interest accrual */
  lastUpdate: bigint;
  /** Protocol fee rate */
  fee: bigint;
};

export type MorphoMarketDataHook = ReadHook & {
  data?: MorphoMarketData;
};

/**
 * Hook for fetching Morpho market data from the Morpho Blue core contract.
 *
 * Returns market state including total supply, total borrow, available liquidity,
 * and utilization rate.
 *
 * @param marketId - The bytes32 market ID (required)
 */
export function useMorphoMarketData({ marketId }: { marketId?: `0x${string}` }): MorphoMarketDataHook {
  const chainId = useChainId();

  const {
    data: marketState,
    isLoading,
    error,
    refetch
  } = useReadMorphoBlueMarket({
    args: marketId ? [marketId] : undefined,
    query: {
      enabled: !!marketId
    }
  });

  const parsedData = useMemo<MorphoMarketData | undefined>(() => {
    if (!marketState) return undefined;

    const [totalSupplyAssets, , totalBorrowAssets, , lastUpdate, fee] = marketState;

    const liquidity = totalSupplyAssets - totalBorrowAssets;

    // Calculate utilization as a decimal (0-1)
    // Avoid division by zero
    const utilization =
      totalSupplyAssets > 0n ? Number((totalBorrowAssets * 10000n) / totalSupplyAssets) / 10000 : 0;

    return {
      totalSupplyAssets,
      totalBorrowAssets,
      liquidity,
      utilization,
      lastUpdate,
      fee
    };
  }, [marketState]);

  // Data sources for transparency
  const dataSources: DataSource[] = [
    {
      title: 'Morpho Blue Contract',
      onChain: true,
      href: getEtherscanLink(chainId, morphoBlueAddress[1], 'address'),
      trustLevel: TRUST_LEVELS[TrustLevelEnum.ZERO]
    }
  ];

  return {
    isLoading,
    data: parsedData,
    error: error || null,
    mutate: refetch,
    dataSources
  };
}
