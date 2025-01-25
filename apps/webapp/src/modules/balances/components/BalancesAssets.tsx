/* eslint-disable react/no-unescaped-entities */
import { HStack } from '@/modules/layout/components/HStack';
import { usePrices, useTokenBalances } from '@jetstreamgg/hooks';
import { useAccount, useChainId } from 'wagmi';
import { LoadingAssetBalanceCard } from './LoadingAssetBalanceCard';
import { AssetBalanceCard } from './AssetBalanceCard';
import { LoadingErrorWrapper } from '@/modules/ui/components/LoadingErrorWrapper';
import { Text } from '@/modules/layout/components/Typography';
import { Trans } from '@lingui/react/macro';
import { defaultConfig } from '@/modules/config/default-config';
import { TokenItem } from '@jetstreamgg/hooks';

type BalancesAssetsProps = {
  chainIds?: number[];
};

export function BalancesAssets({ chainIds }: BalancesAssetsProps) {
  const { address } = useAccount();
  const currentChainId = useChainId();
  const chainsToQuery = chainIds ?? [currentChainId];
  const { data: pricesData, isLoading: pricesIsLoading, error: pricesError } = usePrices();

  // Create an object mapping chainIds to their tokens
  const chainTokenMap = chainsToQuery.reduce<Record<number, TokenItem[]>>(
    (acc, chainId) => ({
      ...acc,
      [chainId]: defaultConfig.balancesTokenList[chainId] ?? []
    }),
    {}
  );

  const {
    data: tokenBalances,
    isLoading: tokenBalancesIsLoading,
    error: balanceError
  } = useTokenBalances({
    address,
    chainTokenMap
  });
  console.log('tokenBalances', tokenBalances);
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

  return (
    <LoadingErrorWrapper
      isLoading={tokenBalancesIsLoading || !sortedTokenBalances}
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
        {sortedTokenBalances?.map(tokenBalance => {
          if (!tokenBalance) return null;
          const priceData = pricesData?.[tokenBalance.symbol];

          return (
            <AssetBalanceCard
              key={tokenBalance.symbol}
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
