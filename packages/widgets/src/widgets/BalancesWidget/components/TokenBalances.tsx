import { VStack } from '@/shared/components/ui/layout/VStack';
import { useTokenBalances, usePrices, TokenForChain, TokenItem } from '@jetstreamgg/hooks';
import { defaultConfig } from '@/config/default-config';
import { useAccount, useChainId } from 'wagmi';
import { AssetBalance } from './AssetBalance';

export const TokenBalances = ({
  actionForToken,
  customTokenMap,
  chainIds
}: {
  actionForToken?: (
    symbol: string,
    balance: string,
    tokenChainId: number
  ) => { label: string; actionUrl: string; image: string } | undefined;
  customTokenMap?: { [chainId: number]: TokenForChain[] };
  chainIds?: number[];
}) => {
  const { address } = useAccount();
  const chainId = useChainId();
  const chainsToQuery = chainIds ?? [chainId];

  // Create an object mapping chainIds to their tokens
  const defaultChainTokenMap: Record<number, TokenItem[]> = {};
  for (const chainId of chainsToQuery) {
    defaultChainTokenMap[chainId] = defaultConfig.balancesTokenList[chainId] ?? [];
  }

  const customChainTokenMap: Record<number, TokenItem[]> = {};
  for (const chainId of chainsToQuery) {
    customChainTokenMap[chainId] = customTokenMap?.[chainId] ?? [];
  }

  // Use customTokenMap if provided, otherwise use the default config
  const chainTokenMap =
    customChainTokenMap && Object.values(customChainTokenMap).some(tokenArray => tokenArray?.length > 0)
      ? customChainTokenMap
      : defaultChainTokenMap;

  const { data: pricesData, isLoading: pricesLoading /*, error: pricesError */ } = usePrices();
  const {
    data: tokenBalances,
    isLoading: tokenBalancesLoading
    /* error: tokenBalancesError */
  } = useTokenBalances({ address, chainTokenMap });

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

  const isLoading = tokenBalancesLoading || pricesLoading;

  // TODO handle error
  // const error = tokenBalancesError || pricesError;
  return (
    <VStack gap={2}>
      {sortedTokenBalances?.map(tokenBalance => {
        const priceData = pricesData?.[tokenBalance.symbol];
        return (
          <AssetBalance
            key={`${tokenBalance.symbol}-${tokenBalance.chainId}`}
            symbol={tokenBalance.symbol}
            chainId={tokenBalance.chainId}
            isLoading={isLoading}
            decimals={tokenBalance.decimals}
            formatted={tokenBalance.formatted}
            priceData={priceData}
            value={tokenBalance.value}
            actionForToken={actionForToken}
          />
        );
      })}
    </VStack>
  );
};
