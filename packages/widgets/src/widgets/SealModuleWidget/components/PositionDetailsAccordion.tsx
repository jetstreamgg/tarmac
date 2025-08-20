import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '@widgets/components/ui/accordion';
import { positionAnimations } from '@widgets/shared/animation/presets';
import { TextWithTooltip } from '@widgets/shared/components/ui/tooltip/TextWithTooltip';
import { Text } from '@widgets/shared/components/ui/Typography';
import { captitalizeFirstLetter, formatBigInt, formatPercent, math } from '@jetstreamgg/sky-utils';
import { motion } from 'framer-motion';
import { getRiskTextColor } from '../lib/utils';
import { RiskLevel, Token, TOKENS, useCollateralData, useMkrSkyRate } from '@jetstreamgg/sky-hooks';
import { cn } from '@widgets/lib/utils';
import { getTooltipById } from '../../../data/tooltips';

type Props = {
  collateralizationRatio?: bigint;
  riskLevel?: string;
  sealedAmount?: bigint;
  borrowedAmount?: bigint;
  liquidationData?: {
    isInLiquidatedState: boolean;
    urnAddress: string;
  };
  delayedPrice?: bigint;
  liquidationPrice?: bigint;
  displayToken: Token;
  setDisplayToken: (token: Token) => void;
};

export function PositionDetailAccordion({
  collateralizationRatio,
  riskLevel,
  sealedAmount,
  borrowedAmount,
  liquidationData,
  delayedPrice,
  liquidationPrice,
  displayToken
}: Props) {
  const riskTextColor = getRiskTextColor(riskLevel as RiskLevel);
  const { data: collateralData } = useCollateralData();
  const { data: mkrSkyRate } = useMkrSkyRate();

  return (
    <Accordion type="single" collapsible>
      <AccordionItem value="item-1">
        <AccordionTrigger className="text-textSecondary py-1">
          <Text variant="medium" className="font-medium">
            Position details
          </Text>
        </AccordionTrigger>
        <AccordionContent className="space-y-4 pt-4">
          <motion.div className="flex justify-between" variants={positionAnimations}>
            <TextWithTooltip
              text={
                getTooltipById(displayToken === TOKENS.mkr ? 'sealed-amount-mkr' : 'sealed-amount-sky')
                  ?.title || 'Sealed'
              }
              tooltip={
                getTooltipById(displayToken === TOKENS.mkr ? 'sealed-amount-mkr' : 'sealed-amount-sky')
                  ?.tooltip || ''
              }
              textClassName="leading-4"
              gap={1}
              iconClassName="text-textSecondary"
            />
            <Text className="text-right text-sm">
              {formatBigInt(
                displayToken === TOKENS.mkr
                  ? sealedAmount || 0n
                  : mkrSkyRate
                    ? math.calculateConversion(TOKENS.mkr, sealedAmount || 0n, mkrSkyRate)
                    : 0n
              )}{' '}
              {displayToken.symbol}
            </Text>
          </motion.div>
          {!!borrowedAmount && borrowedAmount > 0n && (
            <motion.div className="flex justify-between" variants={positionAnimations}>
              <TextWithTooltip
                text={getTooltipById('borrowed-amount-seal')?.title || 'Borrowed'}
                tooltip={getTooltipById('borrowed-amount-seal')?.tooltip || ''}
                textClassName="leading-4"
                gap={1}
                iconClassName="text-textSecondary"
              />
              <Text className="text-right text-sm">{formatBigInt(borrowedAmount)} USDS</Text>
            </motion.div>
          )}
          {!!collateralData?.stabilityFee && (
            <motion.div className="flex justify-between" variants={positionAnimations}>
              <TextWithTooltip
                text={getTooltipById('borrow-rate-seal')?.title || 'Borrow rate'}
                tooltip={getTooltipById('borrow-rate-seal')?.tooltip || ''}
                textClassName="leading-4"
                contentClassname="w-[400px]"
                gap={1}
                iconClassName="text-textSecondary"
              />
              <Text className="text-right text-sm">{formatPercent(collateralData.stabilityFee)}</Text>
            </motion.div>
          )}
          {!!collateralizationRatio && (
            <motion.div className="flex justify-between" variants={positionAnimations}>
              <TextWithTooltip
                text={getTooltipById('collateralization-ratio-seal')?.title || 'Collateralization ratio'}
                tooltip={getTooltipById('collateralization-ratio-seal')?.tooltip || ''}
                textClassName="leading-4"
                contentClassname="w-[400px]"
                gap={1}
                iconClassName="text-textSecondary"
              />
              <Text className={cn('text-right text-sm', riskTextColor)}>
                {formatPercent(collateralizationRatio)}
              </Text>
            </motion.div>
          )}
          {!!liquidationPrice && liquidationPrice > 0n && (
            <motion.div className="flex justify-between" variants={positionAnimations}>
              <TextWithTooltip
                text={
                  getTooltipById('liquidation-price-seal-' + (displayToken === TOKENS.mkr ? 'mkr' : 'sky'))
                    ?.title || 'Liquidation price'
                }
                tooltip={
                  getTooltipById('liquidation-price-seal-' + (displayToken === TOKENS.mkr ? 'mkr' : 'sky'))
                    ?.tooltip || ''
                }
                textClassName="leading-4"
                contentClassname="w-[400px]"
                gap={1}
                iconClassName="text-textSecondary"
              />
              <Text className="text-right text-sm">
                $
                {formatBigInt(
                  displayToken === TOKENS.mkr
                    ? liquidationPrice
                    : mkrSkyRate
                      ? math.calculateMKRtoSKYPrice(liquidationPrice, mkrSkyRate)
                      : 0n
                )}
              </Text>
            </motion.div>
          )}
          {!!delayedPrice && delayedPrice > 0n && (
            <motion.div className="flex justify-between" variants={positionAnimations}>
              <Text className="text-textSecondary text-sm font-normal leading-4">{`Current ${displayToken.symbol} price`}</Text>
              <Text className="text-right text-sm">
                $
                {formatBigInt(
                  displayToken === TOKENS.mkr
                    ? delayedPrice
                    : mkrSkyRate
                      ? math.calculateMKRtoSKYPrice(delayedPrice, mkrSkyRate)
                      : 0n
                )}
              </Text>
            </motion.div>
          )}
          {!!riskLevel && (
            <motion.div className="flex justify-between" variants={positionAnimations}>
              <TextWithTooltip
                text={getTooltipById('risk-level-seal')?.title || 'Risk level'}
                tooltip={getTooltipById('risk-level-seal')?.tooltip || ''}
                textClassName="leading-4"
                contentClassname="w-[400px]"
                gap={1}
                iconClassName="text-textSecondary"
              />
              <Text
                className={cn(
                  'text-right text-sm',
                  liquidationData?.isInLiquidatedState ? 'text-red-500' : riskTextColor
                )}
              >
                {liquidationData?.isInLiquidatedState
                  ? 'Liquidated'
                  : captitalizeFirstLetter(riskLevel.toLowerCase())}
              </Text>
            </motion.div>
          )}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
