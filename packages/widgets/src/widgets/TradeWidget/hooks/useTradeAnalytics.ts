import { useCallback } from 'react';
import { formatUnits } from 'viem';
import { TokenForChain, getTokenDecimals, OrderQuoteResponse } from '@jetstreamgg/sky-hooks';
import { useChainId } from 'wagmi';
import { WidgetAnalyticsEvent } from '@widgets/shared/types/analyticsEvents';

interface UseTradeAnalyticsParams {
  onAnalyticsEvent?: (event: WidgetAnalyticsEvent) => void;
  swapProvider: 'cowswap' | 'psm';
  originToken?: TokenForChain;
  targetToken?: TokenForChain;
  debouncedOriginAmount: bigint;
  targetAmount: bigint;
  /** CowSwap quote data — slippage & quoteKind are extracted from here when available */
  quoteData?: OrderQuoteResponse | null;
  /** Explicit quoteKind fallback for PSM (derived from lastUpdated: TradeSide.IN → 'sell', TradeSide.OUT → 'buy') */
  quoteKind?: string;
  batchEnabled: boolean;
}

export function useTradeAnalytics({
  onAnalyticsEvent,
  swapProvider,
  originToken,
  targetToken,
  debouncedOriginAmount,
  targetAmount,
  quoteData,
  quoteKind,
  batchEnabled
}: UseTradeAnalyticsParams) {
  const chainId = useChainId();

  const swapData: Record<string, unknown> = {
    module: 'trade',
    swapProvider,
    tokenAddressFrom: originToken?.address,
    tokenSymbolFrom: originToken?.symbol,
    tokenAddressTo: targetToken?.address,
    tokenSymbolTo: targetToken?.symbol,
    amountFrom: originToken
      ? Number(formatUnits(debouncedOriginAmount, getTokenDecimals(originToken, chainId)))
      : undefined,
    amountTo: targetToken
      ? Number(formatUnits(targetAmount, getTokenDecimals(targetToken, chainId)))
      : undefined,
    isEthFlow: !!originToken?.isNative,
    slippage: quoteData?.quote?.slippageTolerance,
    quoteKind: quoteData?.quote?.kind ?? quoteKind,
    isBatchTx: batchEnabled
  };

  const fireAnalytics = useCallback(
    (event: WidgetAnalyticsEvent) => {
      try {
        onAnalyticsEvent?.(event);
      } catch {
        // Silently swallow — analytics must never break functionality
      }
    },
    [onAnalyticsEvent]
  );

  return { fireAnalytics, swapData };
}
