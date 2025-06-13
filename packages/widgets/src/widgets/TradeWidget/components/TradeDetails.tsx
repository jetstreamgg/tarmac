import { t } from '@lingui/core/macro';
import { getTokenDecimals, OrderQuoteResponse, TokenForChain } from '@jetstreamgg/sky-hooks';
import { TransactionOverview } from '@widgets/shared/components/ui/transaction/TransactionOverview';
import { formatNumber } from '@jetstreamgg/sky-utils';
import { formatUnits } from 'viem';
import { useChainId } from 'wagmi';

type TradeDetailsProps = {
  quoteData: OrderQuoteResponse | null | undefined;
  originToken?: TokenForChain;
  targetToken?: TokenForChain;
  exactInput: boolean;
  isQuoteLoading: boolean;
  priceImpact: number | undefined;
};

export function TradeDetails({
  quoteData,
  originToken,
  targetToken,
  exactInput,
  isQuoteLoading,
  priceImpact
}: TradeDetailsProps) {
  const chainId = useChainId();
  const transactionData =
    !quoteData || isQuoteLoading || !originToken || !targetToken || priceImpact === undefined
      ? undefined
      : [
          {
            label: t`Price impact`,
            value: `${formatNumber(priceImpact, { maxDecimals: 2 })}%`,
            error: priceImpact >= 1
          },
          {
            label: t`Slippage tolerance`,
            value: `${quoteData.quote.slippageTolerance}%`
          },
          {
            label: t`Network costs (est.)`,
            value: exactInput
              ? `${formatNumber(+formatUnits(quoteData.quote.feeAmountInBuyToken, getTokenDecimals(targetToken, chainId)))} ${
                  targetToken.symbol
                }`
              : `${formatNumber(+formatUnits(quoteData.quote.feeAmount, getTokenDecimals(originToken, chainId)))} ${
                  originToken.symbol
                }`
          },
          {
            label: exactInput ? t`Expected output` : t`Expected input`,
            value: `${
              exactInput
                ? formatNumber(
                    +formatUnits(quoteData.quote.buyAmountBeforeFee, getTokenDecimals(targetToken, chainId)),
                    {
                      unit: getTokenDecimals(targetToken, chainId)
                    }
                  )
                : formatNumber(
                    +formatUnits(quoteData.quote.sellAmountAfterFee, getTokenDecimals(originToken, chainId)),
                    {
                      unit: getTokenDecimals(originToken, chainId)
                    }
                  )
            } ${exactInput ? targetToken.symbol : originToken.symbol}`
          },
          {
            label: exactInput ? t`Minimum output` : t`Maximum input`,
            value: `${
              exactInput
                ? formatNumber(
                    +formatUnits(quoteData.quote.buyAmountBeforeFee, getTokenDecimals(targetToken, chainId)) *
                      (1 - quoteData.quote.slippageTolerance / 100),
                    {
                      unit: getTokenDecimals(targetToken, chainId)
                    }
                  )
                : formatNumber(
                    +formatUnits(quoteData.quote.sellAmountAfterFee, getTokenDecimals(originToken, chainId)) *
                      (1 + quoteData.quote.slippageTolerance / 100),
                    {
                      unit: getTokenDecimals(originToken, chainId)
                    }
                  )
            } ${exactInput ? targetToken.symbol : originToken.symbol}`
          }
        ];

  return (
    <TransactionOverview
      title={t`Trade details`}
      isFetching={isQuoteLoading}
      fetchingMessage={t`Fetching price`}
      transactionData={transactionData}
    />
  );
}
