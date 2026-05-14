import { formatUnits } from 'viem';
import { mainnet } from 'viem/chains';
import type { PendleConvertQuote, PendleMarketConfig, Token } from '@/hooks';

export type PendleAnalyticsSide = 'buy' | 'sell' | 'redeem';

export type PendleAnalyticsDataInput = {
  market: PendleMarketConfig;
  side: PendleAnalyticsSide;
  originToken: Token;
  targetToken: Token;
  amountFromBigint: bigint;
  amountToBigint: bigint;
  fromDecimals: number;
  toDecimals: number;
  slippage: number;
  quote?: PendleConvertQuote;
  isBatchTx: boolean;
};

const MS_PER_DAY = 86_400_000;

// `amount` in the consolidated blob (and the top-level event property where
// applicable) is in `formatUnits` decimals — BUY's is underlying-token decimals,
// SELL/REDEEM's is PT-token decimals. PT ≈ underlying at maturity, so
// cross-direction aggregate sums are approximate. Same approximation PSM makes.
export function pendleAnalyticsData(input: PendleAnalyticsDataInput): Record<string, unknown> {
  const {
    market,
    isBatchTx,
    originToken,
    targetToken,
    amountFromBigint,
    amountToBigint,
    fromDecimals,
    toDecimals,
    slippage,
    quote
  } = input;

  const daysToMaturity = Math.max(0, Math.ceil((market.expiry * 1000 - Date.now()) / MS_PER_DAY));

  return {
    module: 'pendle',
    product: market.name,
    productAddress: market.marketAddress,
    assetAddress: market.underlyingToken,
    assetSymbol: market.underlyingSymbol,
    isBatchTx,
    tokenSymbolFrom: originToken.symbol,
    tokenAddressFrom: originToken.address[mainnet.id],
    amountFrom: Number(formatUnits(amountFromBigint, fromDecimals)),
    tokenSymbolTo: targetToken.symbol,
    tokenAddressTo: targetToken.address[mainnet.id],
    amountTo: Number(formatUnits(amountToBigint, toDecimals)),
    slippage,
    ptAddress: market.ptToken,
    expiry: market.expiry,
    daysToMaturity,
    ...(quote?.aggregatorType !== undefined && { aggregatorType: quote.aggregatorType }),
    ...(quote?.priceImpact !== undefined && { priceImpact: quote.priceImpact }),
    ...(quote?.effectiveApy !== undefined && { effectiveApy: quote.effectiveApy }),
    ...(quote?.feeUsd !== undefined && { feeUsd: quote.feeUsd })
  };
}
