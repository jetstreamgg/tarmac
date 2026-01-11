import { useId } from 'react';
import { Text } from '@widgets/shared/components/ui/Typography';
import { Checkbox } from '@widgets/components/ui/checkbox';
import { cn } from '@widgets/lib/utils';
import {
  MAX_PRICE_IMPACT_BPS_WITHOUT_WARNING,
  PRICE_IMPACT_WARNING_THRESHOLD_BPS,
  PRICE_IMPACT_HIGH_THRESHOLD_BPS
} from '../lib/constants';

type PriceImpactWarningProps = {
  priceImpactBps: number | undefined;
  swapAnyway: boolean;
  onSwapAnywayChange: (checked: boolean) => void;
};

export const PriceImpactWarning = ({
  priceImpactBps,
  swapAnyway,
  onSwapAnywayChange
}: PriceImpactWarningProps) => {
  const checkboxId = useId();

  if (priceImpactBps === undefined || priceImpactBps < MAX_PRICE_IMPACT_BPS_WITHOUT_WARNING) {
    return null;
  }

  const getTextColor = () => {
    if (priceImpactBps > PRICE_IMPACT_HIGH_THRESHOLD_BPS) return 'text-error';
    if (priceImpactBps > PRICE_IMPACT_WARNING_THRESHOLD_BPS) return 'text-amber-400';
    return 'text-white';
  };

  // Convert basis points to percentage and round down to nearest integer for display
  const priceImpactPercent = Math.floor(priceImpactBps / 100);

  return (
    <div className="flex items-center px-3 pt-1">
      <Checkbox id={checkboxId} checked={swapAnyway} onCheckedChange={onSwapAnywayChange} />
      <label htmlFor={checkboxId} className="ml-2">
        <Text variant="medium" className={cn(getTextColor(), 'cursor-pointer')}>
          I understand the price impact exceeds {priceImpactPercent}% and choose to proceed anyway
        </Text>
      </label>
    </div>
  );
};
