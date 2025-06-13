import { Card, CardContent, CardHeader } from '@widgets/components/ui/card';
import { HStack } from '@widgets/shared/components/ui/layout/HStack';
import { Text } from '@widgets/shared/components/ui/Typography';
import { getTokenDecimals, OrderQuoteResponse } from '@jetstreamgg/sky-hooks';
import { formatNumber } from '@jetstreamgg/sky-utils';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { ArrowRight } from 'lucide-react';
import { TradeSide } from '../lib/constants';
import { TokenIcon } from '@widgets/shared/components/ui/token/TokenIcon';
import { VStack } from '@widgets/shared/components/ui/layout/VStack';
import { InfoTooltip } from '@widgets/shared/components/ui/tooltip/InfoTooltip';
import { motion } from 'framer-motion';
import { positionAnimations } from '@widgets/shared/animation/presets';
import { MotionHStack } from '@widgets/shared/components/ui/layout/MotionHStack';
import { formatUnits } from 'viem';
import { TokenForChain } from '@jetstreamgg/sky-hooks';
import { useChainId } from 'wagmi';

type TradeSummaryProps = {
  quoteData: OrderQuoteResponse;
  lastUpdated: TradeSide;
  originToken: TokenForChain;
  targetToken: TokenForChain;
  priceImpact: number | undefined;
};

export function TradeSummary({
  quoteData,
  lastUpdated,
  originToken,
  targetToken,
  priceImpact
}: TradeSummaryProps) {
  const chainId = useChainId();
  if (priceImpact === undefined) {
    return null;
  }

  const exactInput = lastUpdated === TradeSide.IN;
  const token = exactInput ? targetToken : originToken;
  const expectedQuote = exactInput
    ? +formatUnits(quoteData.quote.buyAmountBeforeFee, getTokenDecimals(targetToken, chainId))
    : +formatUnits(quoteData.quote.sellAmountAfterFee, getTokenDecimals(originToken, chainId));
  const slippageCorrector = exactInput
    ? 1 - quoteData.quote.slippageTolerance / 100
    : 1 + quoteData.quote.slippageTolerance / 100;
  const slippageAdjustedQuote = formatNumber(expectedQuote * slippageCorrector, {
    unit: getTokenDecimals(token, chainId)
  });

  const inputAmount = +formatUnits(
    exactInput ? quoteData.quote.sellAmountAfterFee : quoteData.quote.sellAmountBeforeFee,
    getTokenDecimals(originToken, chainId)
  );
  const outputAmount = +formatUnits(
    exactInput ? quoteData.quote.buyAmountAfterFee : quoteData.quote.buyAmountBeforeFee,
    getTokenDecimals(targetToken, chainId)
  );

  const executionPrice = inputAmount / outputAmount;
  const formattedInputAmount = formatNumber(inputAmount);
  const formattedOutputAmount = formatNumber(outputAmount);
  const formattedExecutionPrice = formatNumber(executionPrice);
  const isPriceImpactHight = priceImpact >= 1;

  return (
    <div>
      <Card className="mb-4" variant="stats">
        <CardHeader>
          <motion.div variants={positionAnimations}>
            <Text variant="medium" className="text-textSecondary font-medium">
              Trade details
            </Text>
          </motion.div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 text-center">
            <MotionHStack className="mb-4 mt-8 items-stretch" variants={positionAnimations}>
              <VStack className="flex-1 items-center gap-3">
                <TokenIcon token={{ symbol: originToken.symbol || 'ETH' }} className="h-8 w-8" />
                <Text variant="large" className="mt-0! flex-1 text-[18px] font-medium">
                  {formattedInputAmount} {originToken.symbol}
                </Text>
              </VStack>
              <ArrowRight className="text-textSecondary self-center" />
              <VStack className="flex-1 items-center gap-3">
                <TokenIcon token={{ symbol: targetToken.symbol || 'ETH' }} className="h-8 w-8" />
                <Text variant="large" className="mt-0! flex-1 text-[18px] font-medium">
                  {formattedOutputAmount} {targetToken.symbol}
                </Text>
              </VStack>
            </MotionHStack>
            {originToken.symbol && targetToken.symbol && (
              <motion.div variants={positionAnimations}>
                <Text variant="medium">
                  1 {targetToken.symbol} = {formattedExecutionPrice} {originToken.symbol}
                </Text>
              </motion.div>
            )}
          </div>
          <hr className="border-brandLight/30" />
          <VStack className="gap-4 space-y-0 pt-5">
            <motion.div variants={positionAnimations} className="flex justify-between">
              <HStack className="items-center" gap={2}>
                <Text variant="medium" className="text-textSecondary">
                  <Trans>Slippage</Trans>
                </Text>
                <InfoTooltip
                  content={t`This reflects your slippage tolerance.`}
                  iconClassName="text-textSecondary"
                />
              </HStack>
              <Text variant="medium">{quoteData.quote.slippageTolerance.toFixed(2)}%</Text>
            </motion.div>
            <motion.div variants={positionAnimations} className="flex justify-between">
              <HStack className="items-center" gap={2}>
                <Text variant="medium" className={isPriceImpactHight ? 'text-error' : 'text-textSecondary'}>
                  <Trans>Estimated price impact</Trans>
                </Text>
              </HStack>
              <Text variant="medium" className={isPriceImpactHight ? 'text-error' : ''}>
                {formatNumber(priceImpact, { maxDecimals: 2 })}%
              </Text>
            </motion.div>
            <motion.div variants={positionAnimations} className="flex justify-between">
              <HStack className="items-center" gap={2}>
                <Text variant="medium" className="text-textSecondary">
                  <Trans>Network costs (est.)</Trans>
                </Text>
                {/* TODO: Add tooltip content */}
                {/* <InfoTooltip content={'Network costs'} iconClassName="text-textSecondary" /> */}
              </HStack>
              <Text variant="medium">
                {exactInput
                  ? `${formatNumber(
                      +formatUnits(
                        quoteData.quote.feeAmountInBuyToken,
                        getTokenDecimals(targetToken, chainId)
                      ),
                      { unit: getTokenDecimals(targetToken, chainId) }
                    )} ${targetToken.symbol}`
                  : `${formatNumber(
                      +formatUnits(quoteData.quote.feeAmount, getTokenDecimals(originToken, chainId)),
                      {
                        unit: getTokenDecimals(originToken, chainId)
                      }
                    )} ${originToken.symbol}`}
              </Text>
            </motion.div>
            <motion.div variants={positionAnimations} className="flex justify-between">
              <HStack className="items-center" gap={2}>
                <Text variant="medium" className="text-textSecondary">
                  {exactInput ? <Trans>Expected output</Trans> : <Trans>Expected input</Trans>}
                </Text>
              </HStack>
              <Text variant="medium">
                {formatNumber(expectedQuote, { unit: getTokenDecimals(token, chainId) })} {token.symbol}
              </Text>
            </motion.div>
            <motion.div variants={positionAnimations} className="flex justify-between">
              <HStack className="items-center" gap={2}>
                <Text variant="medium" className="text-textSecondary">
                  {exactInput ? <Trans>Minimum output</Trans> : <Trans>Maximum input</Trans>}
                </Text>
                {/* TODO: Add tooltip content */}
                <InfoTooltip content={'Minimum output / maximum input'} iconClassName="text-textSecondary" />
              </HStack>
              <Text variant="medium">
                {slippageAdjustedQuote} {token.symbol}
              </Text>
            </motion.div>
          </VStack>
        </CardContent>
      </Card>
      <motion.div variants={positionAnimations}>
        <Text className="text-textSecondary text-balance text-center">
          {exactInput ? (
            <Trans>
              Output is estimated. You will receive at least {slippageAdjustedQuote} {token.symbol} or the
              transaction will revert.
            </Trans>
          ) : (
            <Trans>
              Input is estimated. You will spend at most {slippageAdjustedQuote} {token.symbol} or the
              transaction will revert.
            </Trans>
          )}
        </Text>
      </motion.div>
    </div>
  );
}
