import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { formatUnits } from 'viem';
import { mainnet } from 'viem/chains';
import { formatBigInt, formatDecimalPercentage } from '@/utils';
import {
  formatPendleAggregatorName,
  getTokenDecimals,
  type PendleConvertQuote,
  type PendleMarketConfig,
  type Token
} from '@/hooks';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/widgets/components/ui/tabs';
import { TokenInput } from '@/widgets/shared/components/ui/token/TokenInput';
import { TransactionOverview } from '@/widgets/shared/components/ui/transaction/TransactionOverview';
import { Text } from '@/widgets/shared/components/ui/Typography';
import { motion } from 'motion/react';
import { positionAnimations } from '@/widgets/shared/animation/presets';
import { MotionVStack } from '@/widgets/shared/components/ui/layout/MotionVStack';
import { PendleFlow } from '../lib/constants';
import { VStack } from '@/widgets/shared/components/ui/layout/VStack';
import { getTooltipById } from '@/widgets/data/tooltips';
import { PendleStatsCard } from './PendleStatsCard';

type SupplyWithdrawProps = {
  market: PendleMarketConfig;
  ptToken: Token;
  /** Tokens selectable on BUY input — underlying + USDS + USDC (de-duped). */
  supplyTokenList: Token[];
  /** Tokens selectable on SELL output — supply list minus sUSDS. */
  withdrawTokenList: Token[];
  /** Currently-selected BUY input token. */
  selectedSupplyToken: Token;
  onSupplyTokenChange: (token: Token) => void;
  /** Currently-selected SELL output token. */
  selectedWithdrawOutToken: Token;
  onWithdrawOutTokenChange: (token: Token) => void;
  flow: PendleFlow;
  onFlowChange: (flow: PendleFlow) => void;
  amount: bigint;
  onAmountChange: (val: bigint) => void;
  /** Balance of the input token: BUY → user-selected supply token; SELL → PT. */
  inputBalance?: bigint;
  /** Balance of the output token: BUY → PT; SELL → user-selected output token. */
  outputBalance?: bigint;
  ptBalance?: bigint;
  quote?: PendleConvertQuote;
  isFetchingQuote: boolean;
  slippage: number;
  enabled: boolean;
  insufficientFunds: boolean;
  /** User-friendly message for simulation/prepare failure (e.g. slippage too tight). */
  prepareErrorMessage?: string;
  /** User-friendly message for a failed /convert quote request. */
  quoteErrorMessage?: string;
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
};

export const SupplyWithdraw = ({
  market,
  ptToken,
  supplyTokenList,
  withdrawTokenList,
  selectedSupplyToken,
  onSupplyTokenChange,
  selectedWithdrawOutToken,
  onWithdrawOutTokenChange,
  flow,
  onFlowChange,
  amount,
  onAmountChange,
  inputBalance,
  outputBalance,
  ptBalance,
  quote,
  isFetchingQuote,
  slippage,
  enabled,
  insufficientFunds,
  prepareErrorMessage,
  quoteErrorMessage,
  onExternalLinkClicked
}: SupplyWithdrawProps) => {
  // Pendle PTs share decimals with the underlying SY (which equals the
  // underlying token's decimals). The user-side token may be USDS (18) or
  // USDC (6), so we resolve decimals per-token rather than hardcoding to
  // market.underlyingDecimals.
  const ptDecimals = market.underlyingDecimals;
  const supplyTokenDecimals = getTokenDecimals(selectedSupplyToken, mainnet.id);
  const withdrawOutTokenDecimals = getTokenDecimals(selectedWithdrawOutToken, mainnet.id);

  // Origin = the editable input (top). Target = the read-only output (bottom).
  const originDecimals = flow === PendleFlow.BUY ? supplyTokenDecimals : ptDecimals;
  const targetDecimals = flow === PendleFlow.BUY ? ptDecimals : withdrawOutTokenDecimals;
  const originSymbol = flow === PendleFlow.BUY ? selectedSupplyToken.symbol : `PT-${market.underlyingSymbol}`;
  const targetSymbol =
    flow === PendleFlow.BUY ? `PT-${market.underlyingSymbol}` : selectedWithdrawOutToken.symbol;

  const formattedReceive = quote
    ? `${formatBigInt(quote.amountOut, { unit: targetDecimals, maxDecimals: 4 })} ${targetSymbol}`
    : undefined;
  const formattedMin = quote
    ? `${formatBigInt(quote.apiMinOut, { unit: targetDecimals, maxDecimals: 4 })} ${targetSymbol}`
    : undefined;
  const apyDisplay = quote ? formatDecimalPercentage(quote.effectiveApy) : '—';
  const maturityDisplay = new Date(market.expiry * 1000).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
  // BUY only: 1 PT redeems for 1 USDS at maturity (assetInfo: TOKEN, USDS for
  // PT-sUSDS) — so amountOut in PT units IS the USDS payout at maturity.
  // Future markets with usdsEquivalence !== 'pegged' would need PT × chi here.
  const valueAtMaturity =
    quote && flow === PendleFlow.BUY
      ? `${formatBigInt(quote.amountOut, { unit: targetDecimals, maxDecimals: 4 })} USDS`
      : undefined;

  const errorText = insufficientFunds
    ? t`Insufficient funds. Your balance is ${formatUnits(inputBalance ?? 0n, originDecimals)}.`
    : undefined;

  // Output (target) Token used purely for the read-only TokenInput.
  // BUY → PT. SELL → user-selected output token.
  const targetToken = flow === PendleFlow.BUY ? ptToken : selectedWithdrawOutToken;

  // Pendle's API uses positive = favorable; we display with the inverse
  // convention so positive = unfavorable (matching TradeWidget/StUSDSWidget
  // and broader DeFi conventions). The raw quote.priceImpact stays unflipped
  // for analytics/debugging.
  const displayPriceImpact = quote?.priceImpact !== undefined ? -quote.priceImpact : undefined;
  const priceImpactRow =
    displayPriceImpact !== undefined ? `${(displayPriceImpact * 100).toFixed(3)}%` : '—';

  const aggregatorName = quote?.aggregatorType ? formatPendleAggregatorName(quote.aggregatorType) : undefined;
  // Pendle's API returns priceImpactBreakDown even on no-aggregator routes
  // (with externalPriceImpact = 0). Only surface it when an aggregator is
  // actually used — otherwise the breakdown is misleading noise.
  const breakdown = aggregatorName ? quote?.priceImpactBreakdown : undefined;

  return (
    <MotionVStack gap={0} className="w-full" variants={positionAnimations}>
      <Tabs value={flow}>
        <motion.div variants={positionAnimations}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger position="left" value={PendleFlow.BUY} onClick={() => onFlowChange(PendleFlow.BUY)}>
              <Trans>Supply</Trans>
            </TabsTrigger>
            <TabsTrigger
              position="right"
              value={PendleFlow.WITHDRAW}
              onClick={() => onFlowChange(PendleFlow.WITHDRAW)}
            >
              <Trans>Withdraw</Trans>
            </TabsTrigger>
          </TabsList>
        </motion.div>

        <PendleStatsCard market={market} onExternalLinkClicked={onExternalLinkClicked} />

        <TabsContent value={PendleFlow.BUY}>
          <VStack className="items-stretch" gap={3}>
            <motion.div className="flex w-full flex-col" variants={positionAnimations}>
              <TokenInput
                key={`pendle-supply-${selectedSupplyToken.symbol}`}
                className="w-full"
                label={t`How much would you like to supply?`}
                placeholder={t`Enter amount`}
                token={selectedSupplyToken}
                tokenList={supplyTokenList}
                onTokenSelected={t => onSupplyTokenChange(t)}
                balance={enabled ? inputBalance : undefined}
                value={amount}
                onChange={(newValue: bigint) => onAmountChange(newValue)}
                error={errorText}
                showPercentageButtons={enabled}
                enabled={enabled}
                dataTestId="pendle-supply-input"
              />
            </motion.div>
            <motion.div className="flex w-full flex-col" variants={positionAnimations}>
              <TokenInput
                className="w-full"
                label={t`You receive`}
                token={ptToken}
                tokenList={[ptToken]}
                balance={enabled ? outputBalance : undefined}
                value={quote?.amountOut ?? 0n}
                onChange={() => null}
                readOnly
                enabled={enabled}
                dataTestId="pendle-supply-output"
              />
            </motion.div>
          </VStack>
        </TabsContent>

        <TabsContent value={PendleFlow.WITHDRAW}>
          <VStack className="items-stretch" gap={3}>
            <motion.div className="flex w-full flex-col" variants={positionAnimations}>
              <TokenInput
                className="w-full"
                label={t`How much PT-${market.underlyingSymbol} would you like to withdraw?`}
                placeholder={t`Enter amount`}
                token={ptToken}
                tokenList={[ptToken]}
                balance={enabled ? ptBalance : undefined}
                value={amount}
                onChange={(newValue: bigint) => onAmountChange(newValue)}
                error={errorText}
                showPercentageButtons={enabled}
                enabled={enabled}
                dataTestId="pendle-withdraw-input"
              />
            </motion.div>
            <motion.div className="flex w-full flex-col" variants={positionAnimations}>
              <TokenInput
                key={`pendle-withdraw-out-${selectedWithdrawOutToken.symbol}`}
                className="w-full"
                label={t`You receive`}
                token={targetToken}
                tokenList={withdrawTokenList}
                onTokenSelected={t => onWithdrawOutTokenChange(t)}
                balance={enabled ? outputBalance : undefined}
                value={quote?.amountOut ?? 0n}
                onChange={() => null}
                readOnly
                enabled={enabled}
                dataTestId="pendle-withdraw-output"
              />
            </motion.div>
          </VStack>
          <div
            className="mt-3 rounded-xl bg-amber-500/10 px-3 py-2 text-sm text-amber-300"
            data-testid="pendle-early-withdraw-banner"
          >
            <Trans>
              Withdrawing before maturity uses the current market price, not the originally locked APY.
            </Trans>
          </div>
        </TabsContent>
      </Tabs>

      {(prepareErrorMessage || quoteErrorMessage) && amount > 0n && !insufficientFunds && (
        <Text
          variant="medium"
          className="text-error mt-3"
          dataTestId={quoteErrorMessage ? 'pendle-quote-error-banner' : 'pendle-prepare-error-banner'}
        >
          {quoteErrorMessage ?? prepareErrorMessage}
        </Text>
      )}

      {amount > 0n && !insufficientFunds && (
        <TransactionOverview
          title={t`Transaction overview`}
          isFetching={isFetchingQuote || (!quote && !quoteErrorMessage)}
          fetchingMessage={t`Fetching quote from Pendle`}
          onExternalLinkClicked={onExternalLinkClicked}
          // Section 1 "Transaction overview" (expanded by default) — what the
          // user came for. BUY: amount in, rate, maturity, USDS payout at
          // maturity. SELL: amount in, realized rate, USDS now. Per APP-268.
          pinnedData={
            quote
              ? flow === PendleFlow.BUY
                ? [
                    {
                      label: t`You supply`,
                      value: `${formatBigInt(amount, { unit: originDecimals, maxDecimals: 4 })} ${originSymbol}`
                    },
                    {
                      label: t`Effective APY`,
                      value: apyDisplay,
                      className: quote.effectiveApy < 0 ? 'text-error' : 'text-bullish',
                      tooltipTitle: getTooltipById('effective-apy')?.title || '',
                      tooltipText: getTooltipById('effective-apy')?.tooltip || ''
                    },
                    {
                      label: t`Maturity date`,
                      value: maturityDisplay
                    },
                    {
                      label: t`Value at maturity`,
                      value: valueAtMaturity!
                    }
                  ]
                : [
                    {
                      label: t`You withdraw`,
                      value: `${formatBigInt(amount, { unit: originDecimals, maxDecimals: 4 })} ${originSymbol}`
                    },
                    {
                      label: t`Effective APY`,
                      value: apyDisplay,
                      className: quote.effectiveApy < 0 ? 'text-error' : 'text-bullish',
                      tooltipTitle: getTooltipById('effective-apy')?.title || '',
                      tooltipText: getTooltipById('effective-apy')?.tooltip || ''
                    },
                    {
                      label: t`Maturity date`,
                      value: maturityDisplay
                    },
                    {
                      label: t`You receive`,
                      value: formattedReceive!,
                      tooltipTitle: getTooltipById('early-withdrawal-impact')?.title || '',
                      tooltipText: getTooltipById('early-withdrawal-impact')?.tooltip || ''
                    }
                  ]
              : undefined
          }
          // Section 2 "Transaction details" (collapsed by default) — the
          // technical breakdown: actual PT amount, min received, slippage,
          // price impact + breakdown, routing, fee, plus maturity on SELL.
          transactionData={
            quote
              ? [
                  // BUY: surface the actual PT amount here (the pinned section
                  // shows the USDS-denominated "Value at maturity" instead).
                  // SELL: already pinned as "You receive", don't duplicate.
                  ...(flow === PendleFlow.BUY
                    ? [
                        {
                          label: t`You receive`,
                          value: formattedReceive!
                        }
                      ]
                    : []),
                  {
                    label: t`Min. received`,
                    value: formattedMin!
                  },
                  {
                    label: t`Slippage tolerance`,
                    value: `${(slippage * 100).toFixed(2)}%`
                  },
                  {
                    label: t`Price impact`,
                    value: priceImpactRow
                  },
                  ...(breakdown
                    ? [
                        {
                          label: t`Pendle pool`,
                          value: `${(-breakdown.internalPriceImpact * 100).toFixed(3)}%`,
                          labelClassName: 'pl-4 opacity-70',
                          className: 'opacity-70',
                          containerClassName: '-mt-2'
                        },
                        {
                          // breakdown is only populated when aggregatorName is truthy
                          label: aggregatorName!,
                          value: `${(-breakdown.externalPriceImpact * 100).toFixed(3)}%`,
                          labelClassName: 'pl-4 opacity-70',
                          className: 'opacity-70',
                          containerClassName: '-mt-2'
                        }
                      ]
                    : []),
                  {
                    label: t`Routed via`,
                    // Route order matches actual execution: BUY does the stable
                    // swap first then mints PT; SELL burns PT first then swaps
                    // the underlying to the user's chosen output token. With
                    // no aggregator, the only venue is the Pendle pool.
                    value: !aggregatorName
                      ? 'Pendle pool'
                      : flow === PendleFlow.BUY
                        ? `${aggregatorName} → Pendle pool`
                        : `Pendle pool → ${aggregatorName}`
                  },
                  {
                    label: t`Pendle fee`,
                    value:
                      quote.feeUsd !== undefined ? (
                        `$${quote.feeUsd.toFixed(quote.feeUsd >= 1 ? 2 : 4)}`
                      ) : (
                        <Trans>Included in quote</Trans>
                      )
                  }
                ]
              : undefined
          }
        />
      )}
    </MotionVStack>
  );
};
