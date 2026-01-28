import { Text } from './Typography';
import { PopoverRateInfo } from './PopoverRateInfo';
import { ArrowRight } from 'lucide-react';
import React from 'react';

interface RateLineWithArrowProps {
  rateText: string;
  popoverType: 'ssr' | 'srr' | 'str' | 'stusds' | 'expert';
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
  showArrow?: boolean;
}

export const RateLineWithArrow = ({
  rateText,
  popoverType,
  onExternalLinkClicked,
  showArrow = true
}: RateLineWithArrowProps) => {
  return (
    <div className="flex items-center gap-2">
      <div className="flex w-fit items-center gap-1.5">
        <Text variant="small" className="text-bullish leading-4">
          {rateText}
        </Text>
        <PopoverRateInfo
          type={popoverType}
          onExternalLinkClicked={onExternalLinkClicked}
          iconClassName="h-[13px] w-[13px]"
        />
      </div>
      {showArrow && (
        <div className="h-4 w-4 flex-shrink-0">
          <ArrowRight
            size={16}
            className="opacity-0 transition-opacity group-hover/interactive-card:opacity-100"
          />
        </div>
      )}
    </div>
  );
};
