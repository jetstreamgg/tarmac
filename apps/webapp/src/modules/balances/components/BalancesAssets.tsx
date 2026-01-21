/* eslint-disable react/no-unescaped-entities */
import { usePrices, useTokenBalances } from '@jetstreamgg/sky-hooks';
import { useConnection, useChainId } from 'wagmi';
import { LoadingErrorWrapper } from '@/modules/ui/components/LoadingErrorWrapper';
import { Text } from '@/modules/layout/components/Typography';
import { Trans } from '@lingui/react/macro';
import { defaultConfig } from '@/modules/config/default-config';
import { TokenItem } from '@jetstreamgg/sky-hooks';
import { useBalanceFilters } from '@/modules/ui/context/BalanceFiltersContext';
import { Table, TableBody } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { useMemo, useState } from 'react';
import { BalancesTableHeader } from './BalancesTableHeader';
import { LoadingBalancesTable } from './LoadingBalancesTable';
import { BalancesTableBodyRow } from './BalancesTableBodyRow';

type BalancesAssetsProps = {
  chainIds?: number[];
};

export const INITIAL_TOKEN_COUNT = 5;

export function BalancesAssets({ chainIds }: BalancesAssetsProps) {
  const { address } = useConnection();
  const currentChainId = useChainId();
  const chainsToQuery = chainIds ?? [currentChainId];
  const { data: pricesData, isLoading: pricesIsLoading, error: pricesError } = usePrices();
  const { showAllNetworks } = useBalanceFilters();
  const [showAll, setShowAll] = useState(false);

  const toggleShowAll = () => {
    setShowAll(prev => !prev);
  };

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
  const balancesWithBalanceFilter = sortedTokenBalances?.filter(({ value }) => value > 0n);

  // Apply network filter
  const filteredAndSortedTokenBalances = showAllNetworks
    ? balancesWithBalanceFilter
    : balancesWithBalanceFilter?.filter(({ chainId: id }) => id === currentChainId);

  const paginatedTokenBalances = useMemo(() => {
    return filteredAndSortedTokenBalances?.slice(0, showAll ? undefined : INITIAL_TOKEN_COUNT);
  }, [filteredAndSortedTokenBalances, showAll]);

  if (filteredAndSortedTokenBalances?.length === 0 && !tokenBalancesIsLoading) {
    return <Text className="text-text text-center">No balances found</Text>;
  }

  return (
    <LoadingErrorWrapper
      isLoading={tokenBalancesIsLoading || !filteredAndSortedTokenBalances}
      loadingComponent={<LoadingBalancesTable />}
      error={balanceError}
      errorComponent={
        <Text variant="large" className="text-text text-center">
          <Trans>We couldn't load your funds. Please try again later.</Trans>
        </Text>
      }
    >
      <div className="@container">
        <Table>
          <BalancesTableHeader />
          <TableBody>
            {paginatedTokenBalances?.map(tokenBalance => {
              if (!tokenBalance) return null;
              const priceData = pricesData?.[tokenBalance.symbol];

              return (
                <BalancesTableBodyRow
                  key={`${tokenBalance.symbol}-${tokenBalance.chainId}`}
                  isLoading={pricesIsLoading || !pricesData}
                  error={pricesError}
                  price={priceData?.price}
                  tokenBalance={tokenBalance}
                />
              );
            })}
          </TableBody>
        </Table>
        <div className="mt-3 flex w-full justify-end">
          <Button variant="pagination" className="h-auto py-1 text-sm" onClick={toggleShowAll}>
            Show {showAll ? 'less' : 'all'} tokens
          </Button>
        </div>
      </div>
    </LoadingErrorWrapper>
  );
}
