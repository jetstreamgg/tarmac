/* eslint-disable react/no-unescaped-entities */
import { HStack } from '@/modules/layout/components/HStack';
import { usePrices, useTokenBalances } from '@jetstreamgg/sky-hooks';
import { useAccount, useChainId } from 'wagmi';
import { LoadingAssetBalanceCard } from './LoadingAssetBalanceCard';
import { AssetBalanceCard } from './AssetBalanceCard';
import { LoadingErrorWrapper } from '@/modules/ui/components/LoadingErrorWrapper';
import { Text } from '@/modules/layout/components/Typography';
import { Trans } from '@lingui/react/macro';
import { defaultConfig } from '@/modules/config/default-config';
import { TokenItem } from '@jetstreamgg/sky-hooks';
import { useBalanceFilters } from '@/modules/ui/context/BalanceFiltersContext';

type BalancesAssetsProps = {
  chainIds?: number[];
};

export function BalancesAssets({ chainIds }: BalancesAssetsProps) {
  const { address } = useAccount();
  const currentChainId = useChainId();
  const chainsToQuery = chainIds ?? [currentChainId];
  const { data: pricesData, isLoading: pricesIsLoading, error: pricesError } = usePrices();
  const { hideZeroBalances, showAllNetworks } = useBalanceFilters();

  // Create an object mapping chainIds to their tokens
  const chainTokenMap: Record<number, TokenItem[]> = {};
  for (const chainId of chainsToQuery) {
    chainTokenMap[chainId] = defaultConfig.balancesTokenList[chainId] ?? [];
  }

  const {
    data: tokenBalances,
    isLoading: tokenBalancesIsLoading,
    error: balanceError
  } = useTokenBalances({
    address,
    chainTokenMap
  });

  // map token balances to include price
  const tokenBalancesWithPrices =
    tokenBalances?.map(tokenBalance => {
      const price = pricesData?.[tokenBalance.symbol]?.price || 0;
      const tokenDecimalsFactor = Math.pow(10, -tokenBalance.decimals);
      return {
        ...tokenBalance,
        valueInDollars: Number(tokenBalance.value) * tokenDecimalsFactor * Number(price)
      };
    }) || [];

  // sort token balances by total in USD prices
  const sortedTokenBalances =
    tokenBalancesWithPrices && pricesData
      ? tokenBalancesWithPrices.sort((a, b) => b.valueInDollars - a.valueInDollars)
      : undefined;

  // Apply zero balance filter
  const balancesWithBalanceFilter = hideZeroBalances
    ? sortedTokenBalances?.filter(({ value }) => value > 0n)
    : sortedTokenBalances;

  // Apply network filter
  const filteredAndSortedTokenBalances = showAllNetworks
    ? balancesWithBalanceFilter
    : balancesWithBalanceFilter?.filter(({ chainId: id }) => id === currentChainId);

  if (filteredAndSortedTokenBalances?.length === 0 && !tokenBalancesIsLoading) {
    return <Text className="text-text text-center">No balances found</Text>;
  }

  return (
    <LoadingErrorWrapper
      isLoading={tokenBalancesIsLoading || !filteredAndSortedTokenBalances}
      loadingComponent={
        <HStack gap={2} className="scrollbar-thin w-full overflow-auto">
          {[1, 2, 3, 4].map(i => (
            <LoadingAssetBalanceCard key={i} />
          ))}
        </HStack>
      }
      error={balanceError}
      errorComponent={
        <Text variant="large" className="text-text text-center">
          <Trans>We couldn't load your funds. Please try again later.</Trans>
        </Text>
      }
    >
      <HStack gap={2} className="scrollbar-thin w-full overflow-auto">
        {filteredAndSortedTokenBalances?.map(tokenBalance => {
          if (!tokenBalance) return null;
          const priceData = pricesData?.[tokenBalance.symbol];

          return (
            <AssetBalanceCard
              key={`${tokenBalance.symbol}-${tokenBalance.chainId}`}
              tokenBalance={tokenBalance}
              priceData={priceData}
              isLoadingPrice={pricesIsLoading}
              chainId={tokenBalance.chainId}
              error={pricesError}
            />
          );
        })}
      </HStack>
    </LoadingErrorWrapper>
  );
}
