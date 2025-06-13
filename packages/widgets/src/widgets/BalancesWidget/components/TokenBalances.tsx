import { VStack } from '@widgets/shared/components/ui/layout/VStack';
import { PriceData, TokenForChain } from '@jetstreamgg/sky-hooks';
import { AssetBalance } from './AssetBalance';

export const TokenBalances = ({
  actionForToken,
  filteredAndSortedTokenBalances,
  pricesData,
  isLoading
}: {
  actionForToken?: (
    symbol: string,
    balance: string,
    tokenChainId: number
  ) => { label: string; actionUrl: string; image: string } | undefined;
  customTokenMap?: { [chainId: number]: TokenForChain[] };
  chainIds?: number[];
  pricesData?: Record<string, PriceData>;
  isLoading: boolean;
  filteredAndSortedTokenBalances?: {
    valueInDollars: number;
    value: bigint;
    decimals: number;
    formatted: string;
    symbol: string;
    chainId: number;
  }[];
}) => {
  // TODO handle error
  // const error = tokenBalancesError || pricesError;
  return (
    <VStack gap={2}>
      {filteredAndSortedTokenBalances?.map(tokenBalance => {
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
