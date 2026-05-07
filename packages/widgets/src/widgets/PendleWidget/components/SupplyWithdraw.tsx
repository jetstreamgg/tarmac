import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { formatUnits } from 'viem';
import { formatBigInt, formatDecimalPercentage } from '@jetstreamgg/sky-utils';
import {
  isMarketMatured,
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

type SupplyWithdrawProps = {
  market: PendleMarketConfig;
  underlyingToken: Token;
  ptToken: Token;
  flow: PendleFlow;
  onFlowChange: (flow: PendleFlow) => void;
  amount: bigint;
  onAmountChange: (val: bigint) => void;
  underlyingBalance?: bigint;
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

export const SupplyWithdraw = ({
  market,
  underlyingToken,
  ptToken,
  flow,
  onFlowChange,
  amount,
  onAmountChange,
  underlyingBalance,
  ptBalance,
  quote,
  isFetchingQuote,
  slippage,
  enabled,
  insufficientFunds,
  prepareErrorMessage,
  onExternalLinkClicked
}: SupplyWithdrawProps) => {
  const matured = isMarketMatured(market.expiry);
  const isRedeemMode = flow === PendleFlow.WITHDRAW && matured;

  // Pendle PTs inherit decimals from the underlying SY, which inherits from the
  // underlying token. So a PT-USDG (USDG = 6 dec) is 6 dec — input and output
  // share decimals on both flow directions.
  const decimals = market.underlyingDecimals;
  const outputSymbol = flow === PendleFlow.BUY ? `PT-${market.underlyingSymbol}` : market.underlyingSymbol;
  const inputBalance = flow === PendleFlow.BUY ? underlyingBalance : ptBalance;

  const formattedReceive = quote
    ? `${formatBigInt(quote.amountOut, { unit: decimals, maxDecimals: 4 })} ${outputSymbol}`
    : undefined;
  const formattedMin = quote
    ? `${formatBigInt(quote.apiMinOut, { unit: decimals, maxDecimals: 4 })} ${outputSymbol}`
    : undefined;
  const apyDisplay = quote ? formatDecimalPercentage(quote.effectiveApy) : '—';
  const maturityDisplay = new Date(market.expiry * 1000).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });

  const errorText = insufficientFunds
    ? t`Insufficient funds. Your balance is ${formatUnits(inputBalance ?? 0n, decimals)}.`
    : undefined;

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
          <motion.div className="flex w-full flex-col" variants={positionAnimations}>
            <TokenInput
              className="w-full"
              label={t`How much ${market.underlyingSymbol} would you like to supply?`}
              placeholder={t`Enter amount`}
              token={underlyingToken}
              tokenList={[underlyingToken]}
              balance={enabled ? underlyingBalance : undefined}
              value={amount}
              onChange={(newValue: bigint) => onAmountChange(newValue)}
              error={errorText}
              showPercentageButtons={enabled}
              enabled={enabled}
              dataTestId="pendle-supply-input"
            />
          </motion.div>
        </TabsContent>

        <TabsContent value={PendleFlow.WITHDRAW}>
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
            {!matured && (
              <div
                className="mt-3 rounded-xl bg-amber-500/10 px-3 py-2 text-sm text-amber-300"
                data-testid="pendle-early-withdraw-banner"
              >
                <Trans>
                  Withdrawing before maturity uses the current market price, not the originally locked APY.
                </Trans>
              </div>
            )}
            {isRedeemMode && (
              <div className="bg-bullish/10 text-bullish mt-3 rounded-xl px-3 py-2 text-sm">
                <Trans>
                  Maturity reached — redeem 1 PT-{market.underlyingSymbol} for 1 {market.underlyingSymbol}.
                </Trans>
              </div>
            )}
          </motion.div>
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
              value: `${formatBigInt(amount, { unit: decimals, maxDecimals: 4 })} ${
                flow === PendleFlow.BUY ? market.underlyingSymbol : `PT-${market.underlyingSymbol}`
              }`
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
            ...(isRedeemMode
              ? []
              : [
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
                    value:
                      quote?.priceImpact !== undefined
                        ? `${(quote.priceImpact * 100).toFixed(3)}%`
                        : '—'
                  }
                ]),
            {
              label: t`Routing fee`,
              value: isRedeemMode ? (
                <Trans>Free</Trans>
              ) : quote?.feeUsd !== undefined ? (
                `$${quote.feeUsd.toFixed(quote.feeUsd >= 1 ? 2 : 4)}`
              ) : (
                <Trans>Included in quote</Trans>
              )
            }
          ]}
        />
      )}

    </MotionVStack>
  );
};
