import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { ArrowDown } from 'lucide-react';
import { mainnet } from 'viem/chains';
import { formatBigInt, formatDecimalPercentage } from '@jetstreamgg/sky-utils';
import {
  formatPendleAggregatorName,
  getTokenDecimals,
  type PendleConvertQuote,
  type PendleMarketConfig,
  type Token
} from '@jetstreamgg/sky-hooks';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
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
  const formattedReceive = quote
    ? `${formatBigInt(quote.amountOut, { unit: outDecimals, maxDecimals: 4 })} ${selectedOutputToken.symbol}`
    : undefined;
  const formattedMin = quote
    ? `${formatBigInt(quote.apiMinOut, { unit: outDecimals, maxDecimals: 4 })} ${selectedOutputToken.symbol}`
    : undefined;

  const priceImpactRow = quote?.priceImpact !== undefined ? `${(quote.priceImpact * 100).toFixed(3)}%` : '—';
  const aggregatorName = quote?.aggregatorType ? formatPendleAggregatorName(quote.aggregatorType) : undefined;
  // Pendle returns priceImpactBreakDown even on no-aggregator routes — only
  // surface when an aggregator is actually used (matches SupplyWithdraw).
  const breakdown = aggregatorName ? quote?.priceImpactBreakdown : undefined;

  const handleTokenChange = (symbol: string) => {
    const next = outputTokenList.find(t => t.symbol === symbol);
    if (next) onOutputTokenChange(next);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* PT input tile (read-only) */}
      <div
        className="bg-container flex items-center justify-between rounded-2xl px-4 py-3"
        data-testid="pendle-redeem-input"
      >
        <div>
          <Text variant="small" className="text-textSecondary">
            <Trans>You redeem</Trans>
          </Text>
          <Text>{formattedPt}</Text>
        </div>
        <HStack className="items-center" gap={2}>
          <TokenIcon className="h-7 w-7" token={{ symbol: ptSymbol }} showChainIcon={false} />
          <Text>{ptSymbol}</Text>
        </HStack>
      </div>

      {/* Arrow */}
      <div className="flex justify-center">
        <ArrowDown className="text-textSecondary h-4 w-4" />
      </div>

      {/* Output tile (token dropdown) */}
      <div
        className="bg-container flex items-center justify-between rounded-2xl px-4 py-3"
        data-testid="pendle-redeem-output"
      >
        <div>
          <Text variant="small" className="text-textSecondary">
            <Trans>You receive</Trans>
          </Text>
          {quote ? (
            <Text>{formatBigInt(quote.amountOut, { unit: outDecimals, maxDecimals: 4 })}</Text>
          ) : isFetchingQuote ? (
            <Skeleton className="bg-textSecondary h-5 w-24" />
          ) : (
            <Text className="text-textSecondary">—</Text>
          )}
        </div>
        <Select value={selectedOutputToken.symbol} onValueChange={handleTokenChange}>
          <SelectTrigger
            className="border-selectActive w-auto gap-2 rounded-full"
            aria-label={t`Select output token`}
            data-testid="pendle-redeem-output-token"
          >
            <HStack className="items-center" gap={2}>
              <TokenIcon
                className="h-5 w-5"
                token={{ symbol: selectedOutputToken.symbol }}
                showChainIcon={false}
              />
              <SelectValue />
            </HStack>
          </SelectTrigger>
          <SelectContent>
            {outputTokenList.map(token => (
              <SelectItem key={token.symbol} value={token.symbol}>
                <HStack className="items-center" gap={2}>
                  <TokenIcon className="h-4 w-4" token={{ symbol: token.symbol }} showChainIcon={false} />
                  <span>{token.symbol}</span>
                </HStack>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Inline prepare-error banner */}
      {prepareErrorMessage && (
        <div
          className="bg-error/10 text-error rounded-xl px-3 py-2 text-sm"
          data-testid="pendle-redeem-prepare-error"
          role="alert"
        >
          {prepareErrorMessage}
        </div>
      )}

      {/* Transaction overview */}
      <div className="bg-container/60 mt-1 flex flex-col gap-2 rounded-2xl px-4 py-3">
        <Text variant="small" className="text-textSecondary">
          <Trans>Transaction overview</Trans>
        </Text>
        <Row label={t`You redeem`} value={`${formattedPt} ${ptSymbol}`} />
        <Row
          label={t`You receive`}
          value={formattedReceive ?? <Skeleton className="bg-textSecondary h-4 w-20" />}
          isFetching={isFetchingQuote && !quote}
        />
        <Row
          label={t`Min. received`}
          value={formattedMin ?? <Skeleton className="bg-textSecondary h-4 w-20" />}
        />
        <Row label={t`Slippage tolerance`} value={`${(slippage * 100).toFixed(2)}%`} />
        <Row label={t`Price impact`} value={priceImpactRow} />
        {breakdown && (
          <>
            <Row label={t`  · Pendle AMM`} value={`${(breakdown.internalPriceImpact * 100).toFixed(3)}%`} />
            <Row
              label={t`  · Aggregator hop`}
              value={`${(breakdown.externalPriceImpact * 100).toFixed(3)}%`}
            />
          </>
        )}
        {aggregatorName && <Row label={t`Routed via`} value={aggregatorName} />}
        <Row
          label={t`Routing fee`}
          value={
            quote?.feeUsd !== undefined ? (
              `$${quote.feeUsd.toFixed(quote.feeUsd >= 1 ? 2 : 4)}`
            ) : (
              <Trans>Included in quote</Trans>
            )
          }
        />
        {quote?.effectiveApy !== undefined && quote.effectiveApy !== 0 && (
          <Row
            label={t`Effective APY`}
            value={formatDecimalPercentage(quote.effectiveApy)}
            valueClassName="text-bullish"
          />
        )}
      </div>
    </div>
  );
};

function Row({
  label,
  value,
  valueClassName,
  isFetching
}: {
  label: string;
  value: React.ReactNode;
  valueClassName?: string;
  isFetching?: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <Text variant="small" className="text-textSecondary">
        {label}
      </Text>
      {isFetching ? (
        <Skeleton className="bg-textSecondary h-4 w-20" />
      ) : (
        <span className={valueClassName}>{value}</span>
      )}
    </div>
  );
}
