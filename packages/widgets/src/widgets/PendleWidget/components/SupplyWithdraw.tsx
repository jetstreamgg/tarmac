import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { formatUnits } from 'viem';
import { mainnet } from 'viem/chains';
import { formatBigInt, formatDecimalPercentage } from '@jetstreamgg/sky-utils';
import {
  getTokenDecimals,
  type PendleConvertQuote,
  type PendleMarketConfig,
  type Token
} from '@jetstreamgg/sky-hooks';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@widgets/components/ui/tabs';
import { Skeleton } from '@widgets/components/ui/skeleton';
import { TokenInput } from '@widgets/shared/components/ui/token/TokenInput';
import { TransactionOverview } from '@widgets/shared/components/ui/transaction/TransactionOverview';
import { motion } from 'motion/react';
import { positionAnimations } from '@widgets/shared/animation/presets';
import { MotionVStack } from '@widgets/shared/components/ui/layout/MotionVStack';
import { PendleFlow } from '../lib/constants';
import { VStack } from '@widgets/shared/components/ui/layout/VStack';

type SupplyWithdrawProps = {
  market: PendleMarketConfig;
  ptToken: Token;
  /** USDS / USDC / underlying — selectable on BUY input and SELL output. */
  inputTokenList: Token[];
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
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
};

/**
 * Display name for an aggregator. Pendle currently routes through KyberSwap,
 * Odos, OKX, and Paraswap; we render those with canonical brand casing. Any
 * other value (e.g. a future addition) passes through unchanged.
 */
function formatAggregatorName(raw: string): string {
  const known: Record<string, string> = {
    KYBERSWAP: 'KyberSwap',
    ODOS: 'Odos',
    OKX: 'OKX',
    PARASWAP: 'Paraswap'
  };
  return known[raw.toUpperCase()] ?? raw;
}

export const SupplyWithdraw = ({
  market,
  ptToken,
  inputTokenList,
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

  const errorText = insufficientFunds
    ? t`Insufficient funds. Your balance is ${formatUnits(inputBalance ?? 0n, originDecimals)}.`
    : undefined;

  // Output (target) Token used purely for the read-only TokenInput.
  // BUY → PT. SELL → user-selected output token.
  const targetToken = flow === PendleFlow.BUY ? ptToken : selectedWithdrawOutToken;

  const priceImpactRow = quote?.priceImpact !== undefined ? `${(quote.priceImpact * 100).toFixed(3)}%` : '—';

  const aggregatorName = quote?.aggregatorType ? formatAggregatorName(quote.aggregatorType) : undefined;
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

        <TabsContent value={PendleFlow.BUY}>
          <VStack className="items-stretch" gap={3}>
            <motion.div className="flex w-full flex-col" variants={positionAnimations}>
              <TokenInput
                key={`pendle-supply-${selectedSupplyToken.symbol}`}
                className="w-full"
                label={t`How much would you like to supply?`}
                placeholder={t`Enter amount`}
                token={selectedSupplyToken}
                tokenList={inputTokenList}
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
                inputDisabled
                showPercentageButtons={false}
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
                tokenList={inputTokenList}
                onTokenSelected={t => onWithdrawOutTokenChange(t)}
                balance={enabled ? outputBalance : undefined}
                value={quote?.amountOut ?? 0n}
                onChange={() => null}
                inputDisabled
                showPercentageButtons={false}
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

      {prepareErrorMessage && amount > 0n && !insufficientFunds && (
        <div
          className="bg-error/10 text-error mt-3 rounded-xl px-3 py-2 text-sm"
          data-testid="pendle-prepare-error-banner"
          role="alert"
        >
          {prepareErrorMessage}
        </div>
      )}

      {amount > 0n && !insufficientFunds && (
        <TransactionOverview
          title={t`Transaction overview`}
          isFetching={isFetchingQuote && !quote}
          fetchingMessage={t`Fetching quote from Pendle`}
          onExternalLinkClicked={onExternalLinkClicked}
          transactionData={[
            {
              label: flow === PendleFlow.BUY ? t`You supply` : t`You redeem`,
              value: `${formatBigInt(amount, { unit: originDecimals, maxDecimals: 4 })} ${originSymbol}`
            },
            {
              label: t`You receive`,
              value: formattedReceive ?? <Skeleton className="bg-textSecondary h-4 w-20" />
            },
            {
              label: flow === PendleFlow.BUY ? t`Fixed APY locked` : t`Effective APY`,
              value: apyDisplay,
              className: 'text-bullish'
            },
            {
              label: t`Maturity date`,
              value: maturityDisplay
            },
            {
              label: t`Min. received`,
              value: formattedMin ?? <Skeleton className="bg-textSecondary h-4 w-20" />
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
                    label: t`  · Pendle AMM`,
                    value: `${(breakdown.internalPriceImpact * 100).toFixed(3)}%`
                  },
                  {
                    label: t`  · Aggregator hop`,
                    value: `${(breakdown.externalPriceImpact * 100).toFixed(3)}%`
                  }
                ]
              : []),
            ...(aggregatorName
              ? [
                  {
                    label: t`Routed via`,
                    value: aggregatorName
                  }
                ]
              : []),
            {
              label: t`Routing fee`,
              value:
                quote?.feeUsd !== undefined
                  ? `$${quote.feeUsd.toFixed(quote.feeUsd >= 1 ? 2 : 4)}`
                  : <Trans>Included in quote</Trans>
            }
          ]}
        />
      )}
    </MotionVStack>
  );
};
