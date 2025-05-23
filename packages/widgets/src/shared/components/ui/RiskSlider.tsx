import * as React from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { Text } from '@widgets/shared/components/ui/Typography';
import { cn } from '@widgets/lib/utils';
import { HStack } from './layout/HStack';

type RiskSliderProps = React.ComponentProps<typeof SliderPrimitive.Root> & {
  riskColor?: string;
  trackColor?: string;
  liquidationIndicationPercentage?: number;
  showRiskIndicator?: boolean;
  indicatorSize?: number;
  leftLabel?: string;
  rightLabel?: string;
  liquidationLabel?: string;
  sliderLabel?: string;
};

const RISK_INDICATOR_SIZE = 10;

const RiskSlider = React.forwardRef<React.ElementRef<typeof SliderPrimitive.Root>, RiskSliderProps>(
  (
    {
      className,
      liquidationIndicationPercentage = 100,
      showRiskIndicator = true,
      riskColor,
      trackColor,
      leftLabel = 'Low risk',
      rightLabel = 'High risk',
      liquidationLabel,
      sliderLabel,
      indicatorSize = RISK_INDICATOR_SIZE,
      disabled,
      value,
      ...props
    },
    ref
  ) => (
    <>
      {(liquidationLabel || sliderLabel) && (
        <HStack
          className={`${sliderLabel && liquidationLabel ? 'justify-between' : sliderLabel ? 'justify-start' : 'justify-end'} px-2 pb-1`}
        >
          <Text variant="small" className="self-start">
            {sliderLabel}
          </Text>
          <Text variant="small" className="text-error">
            {liquidationLabel}
          </Text>
        </HStack>
      )}
      <SliderPrimitive.Root
        ref={ref}
        value={value}
        className={cn('relative flex w-full touch-none select-none items-center', className)}
        onLostPointerCapture={() => {}} // Fix for onValueCommit not working
        {...props}
      >
        <SliderPrimitive.Track
          className="relative h-1 w-full grow overflow-hidden rounded-full"
          style={{
            background:
              trackColor ||
              'linear-gradient(to right, rgb(74, 222, 128) 0%, rgb(251, 191, 36) 40%, rgb(248, 113, 113) 80%, rgb(239, 68, 68) 100%)'
          }}
        >
          <SliderPrimitive.Range className="absolute h-full bg-transparent" />
        </SliderPrimitive.Track>

        {showRiskIndicator && (
          <div
            className="absolute top-1/2 -translate-y-1/2 transform rounded-full"
            style={{
              left: `calc(${liquidationIndicationPercentage}% - ${indicatorSize}px)`,
              backgroundColor: `${riskColor ? riskColor : 'rgb(239, 68, 68)'}`,
              height: `${indicatorSize}px`,
              width: `${indicatorSize}px`
            }}
          />
        )}
        {disabled ? (
          <SliderPrimitive.Thumb className="focus:outline-hidden block h-0 w-0" aria-label="Slider">
            <div
              className={`absolute ${(value?.[0] || 0) > 95 ? '-left-[20px]' : ''} -top-[0.5px] h-0 w-0 border-b-[11px] border-l-[5.5px] border-r-[5.5px] border-b-white border-l-transparent border-r-transparent`}
            />
          </SliderPrimitive.Thumb>
        ) : (
          <SliderPrimitive.Thumb className="border-primary ring-offset-background focus-visible:ring-ring focus-visible:outline-hidden block rounded-full border-8 bg-white transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50" />
        )}
      </SliderPrimitive.Root>
      <HStack className="justify-between px-4 pt-1">
        <Text variant="small">{leftLabel}</Text>
        <Text variant="small">{rightLabel}</Text>
      </HStack>
    </>
  )
);
RiskSlider.displayName = SliderPrimitive.Root.displayName;

export { RiskSlider };
