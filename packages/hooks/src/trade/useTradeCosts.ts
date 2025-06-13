import { WAD_PRECISION, math } from '@jetstreamgg/sky-utils';
import { OrderQuoteSideKind, cowApiClient } from './constants';
import { formatUnits, parseUnits } from 'viem';
import { useChainId } from 'wagmi';
import { sepolia } from 'viem/chains';
import { mcdDaiAddress, mcdDaiSepoliaAddress } from '../generated';
import { useQueries } from '@tanstack/react-query';
import { ReadHook } from '../hooks';
import { TENDERLY_CHAIN_ID, TRUST_LEVELS, TrustLevelEnum } from '../constants';
import { usePrices } from '../prices/usePrices';
import { TokenForChain } from '../tokens/types';
import { ETH_ADDRESS, getTokenDecimals } from '../tokens/tokens.constants';

const fetchCowTokenPrice = async (token: string, chainId: number) => {
  // no price on tenderly
  if (chainId === TENDERLY_CHAIN_ID) {
    return null;
  }

  try {
    const { data, response } = await cowApiClient[chainId as keyof typeof cowApiClient].GET(
      '/api/v1/token/{token}/native_price',
      {
        params: {
          path: { token }
        }
      }
    );

    if (!response.ok || !data) {
      throw new Error(`Failed to fetch token price for ${token}: ${response.statusText}`);
    }

    return data.price;
  } catch (err) {
    console.error(err);
    return null;
  }
};

export const useTradeCosts = ({
  sellToken,
  buyToken,
  sellAmountBeforeFee,
  sellAmountAfterFee,
  buyAmountBeforeFee,
  buyAmountAfterFee,
  kind
}: {
  sellToken: TokenForChain | undefined;
  buyToken: TokenForChain | undefined;
  sellAmountBeforeFee: bigint | undefined;
  sellAmountAfterFee: bigint | undefined;
  buyAmountBeforeFee: bigint | undefined;
  buyAmountAfterFee: bigint | undefined;
  kind: OrderQuoteSideKind | undefined;
}): ReadHook & { data: { priceImpact: number | undefined; feePercentage: number | undefined } } => {
  const chainId = useChainId();
  const daiAddress =
    chainId === sepolia.id
      ? mcdDaiSepoliaAddress[chainId as keyof typeof mcdDaiSepoliaAddress]
      : mcdDaiAddress[chainId as keyof typeof mcdDaiAddress];
  const isNative = sellToken?.isNative;
  const tokens = [isNative ? ETH_ADDRESS : sellToken?.address, buyToken?.address, daiAddress];

  const {
    data: [sellTokenNativeCowPrice, buyTokenNativeCowPrice, daiNativeCowPrice],
    isLoading: isCowPricesLoading,
    error: cowPricesError,
    refetch: mutateCowPrices
  } = useQueries({
    queries: tokens.map(token => ({
      enabled: !!token,
      queryKey: ['token-price', token],
      queryFn: () => fetchCowTokenPrice(token!, chainId)
    })),
    combine: results => ({
      data: results.map(result => result.data),
      isLoading: results.some(result => result.isLoading),
      error: results.find(result => result.error)?.error || null,
      refetch: () =>
        results.forEach(result => {
          result.refetch();
        })
    })
  });

  const {
    data: baPricesData,
    isLoading: isBaPricesLoading,
    error: baPricesError,
    mutate: mutateBaPrices
  } = usePrices();

  const nativeCowSellTokenPrice =
    sellTokenNativeCowPrice && daiNativeCowPrice && sellToken
      ? (
          (sellTokenNativeCowPrice * 10 ** (getTokenDecimals(sellToken, chainId) - WAD_PRECISION)) /
          daiNativeCowPrice
        ).toString()
      : undefined;

  const nativeCowBuyTokenPrice =
    buyTokenNativeCowPrice && daiNativeCowPrice && buyToken
      ? (
          (buyTokenNativeCowPrice * 10 ** (getTokenDecimals(buyToken, chainId) - WAD_PRECISION)) /
          daiNativeCowPrice
        ).toString()
      : undefined;

  const sellTokenPrice = sellToken
    ? baPricesData?.[sellToken.symbol]?.price ||
      (nativeCowSellTokenPrice ? nativeCowSellTokenPrice : undefined)
    : undefined;
  const buyTokenPrice = buyToken
    ? baPricesData?.[buyToken.symbol]?.price || (nativeCowBuyTokenPrice ? nativeCowBuyTokenPrice : undefined)
    : undefined;

  const sellAmountBeforeFeeUsd =
    sellAmountBeforeFee && sellTokenPrice && sellToken
      ? parseFloat(
          formatUnits(
            math.tokenValue(
              sellAmountBeforeFee,
              parseUnits(sellTokenPrice, getTokenDecimals(sellToken, chainId)),
              getTokenDecimals(sellToken, chainId)
            ),
            WAD_PRECISION
          )
        )
      : undefined;

  const sellAmountAfterFeeUsd =
    sellAmountAfterFee && sellTokenPrice && sellToken
      ? parseFloat(
          formatUnits(
            math.tokenValue(
              sellAmountAfterFee,
              parseUnits(sellTokenPrice, getTokenDecimals(sellToken, chainId)),
              getTokenDecimals(sellToken, chainId)
            ),
            WAD_PRECISION
          )
        )
      : undefined;

  const sellAmountUsd =
    sellAmountBeforeFeeUsd && sellAmountAfterFeeUsd && sellTokenPrice && sellToken
      ? kind === OrderQuoteSideKind.SELL
        ? sellAmountAfterFeeUsd
        : sellAmountBeforeFeeUsd
      : undefined;

  const buyAmountUsd =
    buyAmountBeforeFee && buyAmountAfterFee && buyTokenPrice && buyToken
      ? parseFloat(
          formatUnits(
            math.tokenValue(
              kind === OrderQuoteSideKind.SELL ? buyAmountAfterFee : buyAmountBeforeFee,
              parseUnits(buyTokenPrice, getTokenDecimals(buyToken, chainId)),
              getTokenDecimals(buyToken, chainId)
            ),
            WAD_PRECISION
          )
        )
      : undefined;

  const priceImpact =
    sellAmountUsd && buyAmountUsd ? ((sellAmountUsd - buyAmountUsd) * 100) / sellAmountUsd : undefined;

  const feePercentage =
    sellAmountBeforeFeeUsd && sellAmountAfterFeeUsd
      ? ((sellAmountAfterFeeUsd - sellAmountBeforeFeeUsd) * 100) / sellAmountAfterFeeUsd
      : undefined;

  const isLoading = baPricesError ? isCowPricesLoading : isBaPricesLoading;
  const error =
    baPricesError && cowPricesError ? baPricesError : baPricesError ? null : cowPricesError ? null : null;
  const mutate = baPricesError ? mutateCowPrices : mutateBaPrices;
  const title = baPricesError ? 'CoW Protocol Order book API' : 'BA Labs API';
  const href = baPricesError
    ? 'https://docs.cow.fi/cow-protocol/reference/apis/orderbook'
    : 'https://blockanalitica.com/';

  return {
    data: { priceImpact, feePercentage },
    isLoading,
    error,
    mutate,
    dataSources: [
      {
        title,
        href,
        onChain: false,
        trustLevel: TRUST_LEVELS[TrustLevelEnum.TWO]
      }
    ]
  };
};
