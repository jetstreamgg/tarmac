import { useQuery } from '@tanstack/react-query';
import { useChainId } from 'wagmi';
import { TRUST_LEVELS, TrustLevelEnum } from '../constants';
import { ReadHook } from '../hooks';
import { getBaLabsApiUrl } from '../helpers/getSubgraphUrl';
import { formatBaLabsUrl } from '../helpers';

export interface PriceData {
  underlying_address: string;
  underlying_symbol: string;
  price: string;
  datetime: string;
  source: string;
}

async function fetchPrices(url: URL): Promise<Record<string, PriceData>> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Network response was not ok');
  }

  // return response.json();

  // TODO Adds ETH to match WETH because ETH is missing
  // once this is updated in the API response,
  // we can just return the response
  const data = await response.json();
  let ethItem: PriceData | undefined;
  const priceDataBySymbol: Record<string, PriceData> = {};

  data.forEach((item: PriceData) => {
    if (item.underlying_symbol === 'WETH') {
      ethItem = { ...item, underlying_symbol: 'ETH' };
    }
    priceDataBySymbol[item.underlying_symbol] = item;
  });

  if (ethItem) {
    priceDataBySymbol[ethItem.underlying_symbol] = ethItem;
  }

  return priceDataBySymbol;
}

export function usePrices(): ReadHook & { data?: Record<string, PriceData> } {
  const chainId = useChainId();
  const baseUrl = getBaLabsApiUrl();
  let url: URL | undefined;
  if (baseUrl) {
    const endpoint = `${baseUrl}/prices/`;
    url = formatBaLabsUrl(new URL(endpoint));
  }

  const {
    data,
    error,
    refetch: mutate,
    isLoading
  } = useQuery({
    enabled: true,
    queryKey: ['prices', chainId],
    queryFn: () => (url ? fetchPrices(url) : Promise.resolve({}))
  });

  return {
    data,
    isLoading,
    error,
    mutate,
    dataSources: [
      {
        title: 'BA Labs API',
        href: url?.href || 'https://blockanalitica.com/',
        onChain: false,
        trustLevel: TRUST_LEVELS[TrustLevelEnum.TWO]
      }
    ]
  };
}
