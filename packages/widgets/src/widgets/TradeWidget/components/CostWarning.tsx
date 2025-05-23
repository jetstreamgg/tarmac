import React from 'react';
import { Text } from '@widgets/shared/components/ui/Typography';
import { Checkbox } from '@widgets/components/ui/checkbox';
import { MAX_FEE_PERCENTAGE_WITHOUT_WARNING, MAX_SLIPPAGE_WITHOUT_WARNING } from '../lib/constants';

type CostWarningProps = {
  priceImpact: number | undefined;
  feePercentage: number | undefined;
  tradeAnyway: boolean;
  onTradeAnywayChange: (checked: boolean) => void;
};

export const CostWarning: React.FC<CostWarningProps> = ({
  priceImpact,
  feePercentage,
  tradeAnyway,
  onTradeAnywayChange
}) => {
  if (
    priceImpact === undefined ||
    feePercentage === undefined ||
    (priceImpact < MAX_SLIPPAGE_WITHOUT_WARNING && feePercentage < MAX_FEE_PERCENTAGE_WITHOUT_WARNING)
  )
    return null;

  // TODO update colors and warning thresholds
  const getTextColor = () => {
    if (priceImpact > 30 || feePercentage > 30) return 'text-error';
    if (priceImpact > 5 || feePercentage > 20) return 'text-warning';
    return 'text-white';
  };

  const handleOnClick = () => {
    onTradeAnywayChange(!tradeAnyway);
  };

  // round price impact down to nearest 5%
  const costExceedPercentage = Math.max(
    priceImpact > 5 ? Math.floor(priceImpact / 5) * 5 : Math.floor(priceImpact),
    Math.floor(feePercentage / 5) * 5
  );

  return (
    <div className="flex items-center px-4 pt-4">
      <Checkbox checked={tradeAnyway} onClick={handleOnClick} />
      <Text variant="medium" className={`${getTextColor()} ml-4`}>
        I understand that costs exceed {costExceedPercentage}% of the trade amount and choose to proceed
        anyway
      </Text>
    </div>
  );
};
