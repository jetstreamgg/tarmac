import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { ArrowDown } from 'lucide-react';
import { mainnet } from 'viem/chains';
import { formatBigInt, formatDecimalPercentage, formatNumber } from '@jetstreamgg/sky-utils';
import {
  formatPendleAggregatorName,
  getTokenDecimals,
  type PendleConvertQuote,
  type PendleMarketConfig,
  type Token
} from '@jetstreamgg/sky-hooks';
import { TokenDropdown, TransactionOverview } from '@jetstreamgg/sky-widgets';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { HStack } from '@/modules/layout/components/HStack';
import { Text } from '@/modules/layout/components/Typography';

type PendleRedeemProps = {
  market: PendleMarketConfig;
  /** Read-only PT input — full balance, not editable. */
  ptBalance: bigint;
  /** Token list for the output dropdown (underlying / USDS / USDC). */
  outputTokenList: Token[];
  selectedOutputToken: Token;
  onOutputTokenChange: (token: Token) => void;
  quote?: PendleConvertQuote;
  isFetchingQuote: boolean;
  /** Slippage tolerance as a decimal (e.g. 0.01 = 1%). */
  slippage: number;
  /** User-friendly inline-banner copy for prepare/verify failures. */
  prepareErrorMessage?: string;
};

export const PendleRedeem = ({
  market,
  ptBalance,
  outputTokenList,
  selectedOutputToken,
  onOutputTokenChange,
  quote,
  isFetchingQuote,
  slippage,
  prepareErrorMessage
}: PendleRedeemProps) => {
  const ptSymbol = `PT-${market.underlyingSymbol}`;
  const ptDecimals = market.underlyingDecimals;
  const outDecimals = getTokenDecimals(selectedOutputToken, mainnet.id);

  const formattedPt = formatBigInt(ptBalance, { unit: ptDecimals, maxDecimals: 4 });
  const aggregatorName = quote?.aggregatorType ? formatPendleAggregatorName(quote.aggregatorType) : undefined;
  // Pendle returns the breakdown on no-aggregator routes too; only show it when an aggregator is used.
  const breakdown = aggregatorName ? quote?.priceImpactBreakdown : undefined;

  const isPositiveImpact = (quote?.priceImpact ?? 0) > 0;
  const positiveImpactClass = isPositiveImpact ? 'text-bullish' : undefined;

  const transactionData = quote
    ? [
        {
          label: t`Min. received`,
          value: `${formatBigInt(quote.apiMinOut, { unit: outDecimals, maxDecimals: 4 })} ${selectedOutputToken.symbol}`
        },
        {
          label: t`Slippage tolerance`,
          value: `${formatNumber(slippage * 100, { maxDecimals: 2 })}%`
        },
        {
          label: t`Price impact`,
          value: `${isPositiveImpact ? '+' : ''}${formatNumber(quote.priceImpact * 100, { maxDecimals: 3 })}%`,
          className: positiveImpactClass
        },
        ...(breakdown
          ? [
              {
                label: t`  · Pendle AMM`,
                value: `${formatNumber(breakdown.internalPriceImpact * 100, { maxDecimals: 3 })}%`,
                className: positiveImpactClass
              },
              {
                label: t`  · Aggregator hop`,
                value: `${formatNumber(breakdown.externalPriceImpact * 100, { maxDecimals: 3 })}%`,
                className: positiveImpactClass
              }
            ]
          : []),
        ...(aggregatorName ? [{ label: t`Routed via`, value: aggregatorName }] : []),
        {
          label: t`Routing fee`,
          value:
            quote.feeUsd !== undefined
              ? `$${formatNumber(quote.feeUsd, { maxDecimals: quote.feeUsd >= 1 ? 2 : 4 })}`
              : t`Included in quote`
        },
        ...(quote.effectiveApy !== 0
          ? [
              {
                label: t`Effective APY`,
                value: formatDecimalPercentage(quote.effectiveApy),
                className: 'text-bullish'
              }
            ]
          : [])
      ]
    : undefined;

  return (
    <div className="flex flex-col gap-3">
      <div
        className="bg-card flex items-center justify-between rounded-2xl px-4 py-3"
        data-testid="pendle-redeem-input"
      >
        <div>
          <Text variant="medium" className="text-textSecondary">
            <Trans>You redeem</Trans>
          </Text>
          <Text className="text-lg">{formattedPt}</Text>
        </div>
        <HStack className="items-center" gap={2}>
          <TokenIcon className="h-6 w-6" token={{ symbol: ptSymbol }} showChainIcon={false} />
          <Text>{ptSymbol}</Text>
        </HStack>
      </div>

      <div className="flex justify-center">
        <ArrowDown className="text-textSecondary h-4 w-4" />
      </div>

      <div
        className="bg-card flex items-center justify-between rounded-2xl px-4 py-3"
        data-testid="pendle-redeem-output"
      >
        <div>
          <Text variant="medium" className="text-textSecondary">
            <Trans>You receive</Trans>
          </Text>
          <Text className="text-lg">
            {formatBigInt(quote?.amountOut ?? 0n, { unit: outDecimals, maxDecimals: 4 })}
          </Text>
        </div>
        <TokenDropdown
          token={selectedOutputToken}
          tokenList={outputTokenList}
          onTokenSelected={onOutputTokenChange}
          dataTestId="pendle-redeem-output-token"
        />
      </div>

      {prepareErrorMessage && (
        <div
          className="bg-error/10 text-error rounded-xl px-3 py-2 text-sm"
          data-testid="pendle-redeem-prepare-error"
          role="alert"
        >
          {prepareErrorMessage}
        </div>
      )}

      <TransactionOverview
        title={t`Transaction overview`}
        isFetching={isFetchingQuote && !quote}
        fetchingMessage={t`Fetching quote from Pendle`}
        transactionData={transactionData}
      />
    </div>
  );
};
