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
import { getIlkName, RiskLevel, useCollateralData } from '@jetstreamgg/sky-hooks';
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
  const ilkName = getIlkName(2);
  const riskTextColor = getRiskTextColor(riskLevel as RiskLevel);
  const { data: collateralData } = useCollateralData(ilkName);

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
              text={getTooltipById('staked')?.title || 'Staked'}
              tooltip={getTooltipById('staked')?.tooltip || ''}
              textClassName="leading-4"
              gap={1}
              iconClassName="text-textSecondary"
            />
            <Text className="text-right text-sm">{formatBigInt(sealedAmount || 0n)} SKY</Text>
          </motion.div>
          {!!borrowedAmount && borrowedAmount > 0n && (
            <motion.div className="flex justify-between" variants={positionAnimations}>
              <TextWithTooltip
                text={getTooltipById('borrowed')?.title || 'Borrowed'}
                tooltip={getTooltipById('borrowed')?.tooltip || ''}
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
                text={getTooltipById('borrow')?.title || 'Borrow Rate'}
                tooltip={getTooltipById('borrow')?.tooltip || ''}
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
                text={getTooltipById('collateralization-ratio')?.title || 'Collateralization ratio'}
                tooltip={getTooltipById('collateralization-ratio')?.tooltip || ''}
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
                text={getTooltipById('liquidation-price')?.title || 'Liquidation price'}
                tooltip={getTooltipById('liquidation-price')?.tooltip || ''}
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
              <TextWithTooltip
                text={getTooltipById('capped-osm-sky-price')?.title || 'Capped OSM SKY price'}
                tooltip={getTooltipById('capped-osm-sky-price')?.tooltip || ''}
                textClassName="leading-4"
                gap={1}
                iconClassName="text-textSecondary"
              />
              <Text className="text-right text-sm">${formatBigInt(delayedPrice)}</Text>
            </motion.div>
          )}
          {!!riskLevel && (
            <motion.div className="flex justify-between" variants={positionAnimations}>
              <TextWithTooltip
                text={getTooltipById('risk-level')?.title || 'Risk level'}
                tooltip={getTooltipById('risk-level')?.tooltip || ''}
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
