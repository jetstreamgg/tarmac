import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '@widgets/components/ui/accordion';
import { positionAnimations } from '@widgets/shared/animation/presets';
import { TextWithTooltip } from '@widgets/shared/components/ui/tooltip/TextWithTooltip';
import { Text } from '@widgets/shared/components/ui/Typography';
import { capitalizeFirstLetter, formatBigInt, formatPercent } from '@jetstreamgg/sky-utils';
import { motion } from 'framer-motion';
import { getRiskTextColor } from '../lib/utils';
import { RiskLevel, TOKENS, useCollateralData } from '@jetstreamgg/sky-hooks';
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
};

export function PositionDetailAccordion({
  collateralizationRatio,
  riskLevel,
  sealedAmount,
  borrowedAmount,
  liquidationData,
  delayedPrice,
  liquidationPrice
}: Props) {
  const riskTextColor = getRiskTextColor(riskLevel as RiskLevel);
  const { data: collateralData } = useCollateralData();

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
              text={getTooltipById('sealed-amount-mkr')?.title || 'Sealed'}
              tooltip={getTooltipById('sealed-amount-mkr')?.tooltip || ''}
              textClassName="leading-4"
              gap={1}
              iconClassName="text-textSecondary"
            />
            <Text className="text-right text-sm">
              {formatBigInt(sealedAmount || 0n)} {TOKENS.mkr.symbol}
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
                text={getTooltipById('liquidation-price-seal-mkr')?.title || 'Liquidation price'}
                tooltip={getTooltipById('liquidation-price-seal-mkr')?.tooltip || ''}
                textClassName="leading-4"
                contentClassname="w-[400px]"
                gap={1}
                iconClassName="text-textSecondary"
              />
              <Text className="text-right text-sm">${formatBigInt(liquidationPrice)}</Text>
            </motion.div>
          )}
          {!!delayedPrice && delayedPrice > 0n && (
            <motion.div className="flex justify-between" variants={positionAnimations}>
              <Text className="text-textSecondary text-sm font-normal leading-4">{`Current ${TOKENS.mkr.symbol} price`}</Text>
              <Text className="text-right text-sm">${formatBigInt(delayedPrice)}</Text>
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
                  : capitalizeFirstLetter(riskLevel.toLowerCase())}
              </Text>
            </motion.div>
          )}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
