import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '@widgets/components/ui/accordion';
import { positionAnimations } from '@widgets/shared/animation/presets';
import { PopoverInfo } from '@widgets/shared/components/ui/PopoverInfo';
import { Text } from '@widgets/shared/components/ui/Typography';
import { formatBigInt, formatPercent } from '@jetstreamgg/sky-utils';
import { motion } from 'framer-motion';
import { getIlkName, useCollateralData } from '@jetstreamgg/sky-hooks';
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

export function PositionDetailAccordion({ delayedPrice, liquidationPrice }: Props) {
  const ilkName = getIlkName(2);
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
          {!!collateralData?.stabilityFee && (
            <motion.div className="flex items-center justify-between" variants={positionAnimations}>
              <Text variant="medium" className="text-textSecondary leading-4">
                Borrow Rate
                <PopoverInfo
                  title={getTooltipById('borrow-rate')?.title || 'Borrow Rate'}
                  description={getTooltipById('borrow-rate')?.tooltip || ''}
                  iconClassName="text-textSecondary ml-1"
                />
              </Text>
              <Text className="text-right text-sm">{formatPercent(collateralData.stabilityFee)}</Text>
            </motion.div>
          )}
          {!!liquidationPrice && liquidationPrice > 0n && (
            <motion.div className="flex items-center justify-between" variants={positionAnimations}>
              <Text variant="medium" className="text-textSecondary leading-4">
                Liquidation price
                <PopoverInfo
                  title={getTooltipById('liquidation-price')?.title || 'Liquidation price'}
                  description={getTooltipById('liquidation-price')?.tooltip || ''}
                  iconClassName="text-textSecondary ml-1"
                />
              </Text>
              <Text className="text-right text-sm">${formatBigInt(liquidationPrice)}</Text>
            </motion.div>
          )}
          {!!delayedPrice && delayedPrice > 0n && (
            <motion.div className="flex items-center justify-between" variants={positionAnimations}>
              <Text variant="medium" className="text-textSecondary leading-4">
                Capped OSM SKY price
                <PopoverInfo
                  title={getTooltipById('capped-osm-sky-price')?.title || 'Capped OSM SKY price'}
                  description={getTooltipById('capped-osm-sky-price')?.tooltip || ''}
                  iconClassName="text-textSecondary ml-1"
                />
              </Text>
              <Text className="text-right text-sm">${formatBigInt(delayedPrice)}</Text>
            </motion.div>
          )}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
