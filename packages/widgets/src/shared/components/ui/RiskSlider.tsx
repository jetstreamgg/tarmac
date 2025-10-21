import * as React from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { Text } from '@widgets/shared/components/ui/Typography';
import { cn } from '@widgets/lib/utils';
import { HStack } from './layout/HStack';
import { Tooltip, TooltipContent, TooltipPortal, TooltipTrigger } from '@widgets/components/ui/tooltip';

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
  currentRiskFloor?: number;
  currentRiskCeiling?: number;
  capIndicationPercentage?: number;
  isRepayMode?: boolean;
};

const RISK_INDICATOR_SIZE = 10;

const RiskSlider = React.forwardRef<React.ComponentRef<typeof SliderPrimitive.Root>, RiskSliderProps>(
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
      onValueChange,
      onValueCommit,
      currentRiskFloor,
      currentRiskCeiling,
      capIndicationPercentage,
      isRepayMode,
      ...props
    },
    ref
  ) => {
    const [localValue, setLocalValue] = React.useState(value);

    React.useEffect(() => {
      setLocalValue(value);
    }, [value]);

    const handleValueChange = (v: number[]) => {
      // If currentRiskFloor is set, prevent dragging below it (borrow mode)
      if (currentRiskFloor !== undefined && v[0] < currentRiskFloor) {
        const clampedValue = [currentRiskFloor];
        setLocalValue(clampedValue);
        onValueChange?.(clampedValue);
        return;
      }
      // If currentRiskCeiling is set, prevent dragging above it (repay mode)
      if (currentRiskCeiling !== undefined && v[0] > currentRiskCeiling) {
        const clampedValue = [currentRiskCeiling];
        setLocalValue(clampedValue);
        onValueChange?.(clampedValue);
        return;
      }
      // If capIndicationPercentage is set, prevent dragging past the cap (debt ceiling)
      if (capIndicationPercentage !== undefined && v[0] > capIndicationPercentage) {
        const clampedValue = [capIndicationPercentage];
        setLocalValue(clampedValue);
        onValueChange?.(clampedValue);
        return;
      }
      setLocalValue(v);
      onValueChange?.(v);
    };

    // Calculate offset based on percentage (matches Radix thumb positioning)
    // At 0% offset is +8px, at 50% offset is 0px, at 100% offset is -8px
    const calculateOffset = (percentage: number) => {
      const thumbSize = 16; // Radix thumb size (border-8 = 8px border = 16px total)
      const halfThumb = thumbSize / 2;
      // Linear interpolation: 0% -> +8px, 50% -> 0px, 100% -> -8px
      return halfThumb - (percentage / 100) * thumbSize;
    };

    return (
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
          value={localValue}
          className={cn('relative flex w-full touch-none select-none items-center', className)}
          onValueChange={handleValueChange}
          onValueCommit={onValueCommit}
          {...props}
        >
          <SliderPrimitive.Track
            className={cn(
              'relative h-1 w-full grow overflow-hidden rounded-full',
              !disabled && 'cursor-pointer'
            )}
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
          {capIndicationPercentage !== undefined && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className="absolute top-1/2 -translate-y-1/2 transform rounded-full"
                  style={{
                    left: `calc(${capIndicationPercentage}% + ${calculateOffset(capIndicationPercentage)}px)`,
                    transform: 'translateX(-50%)',
                    backgroundColor: 'rgb(251, 191, 36)',
                    height: `${indicatorSize}px`,
                    width: `${indicatorSize}px`,
                    border: '2px solid rgb(217, 119, 6)'
                  }}
                />
              </TooltipTrigger>
              <TooltipPortal>
                <TooltipContent>Max permitted risk</TooltipContent>
              </TooltipPortal>
            </Tooltip>
          )}
          {currentRiskFloor !== undefined && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className="absolute top-1/2 -translate-y-1/2 transform rounded-full"
                  style={{
                    left: `calc(${currentRiskFloor}% + ${calculateOffset(currentRiskFloor)}px)`,
                    transform: 'translateX(-50%)',
                    backgroundColor: 'rgb(74, 222, 128)',
                    height: `${indicatorSize}px`,
                    width: `${indicatorSize}px`,
                    border: '2px solid rgb(34, 197, 94)'
                  }}
                />
              </TooltipTrigger>
              <TooltipPortal>
                <TooltipContent>Risk floor</TooltipContent>
              </TooltipPortal>
            </Tooltip>
          )}
          {currentRiskCeiling !== undefined && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className="absolute top-1/2 -translate-y-1/2 transform rounded-full"
                  style={{
                    left: `calc(${currentRiskCeiling}% + ${calculateOffset(currentRiskCeiling)}px)`,
                    transform: 'translateX(-50%)',
                    backgroundColor: 'rgb(248, 113, 113)',
                    height: `${indicatorSize}px`,
                    width: `${indicatorSize}px`,
                    border: '2px solid rgb(239, 68, 68)'
                  }}
                />
              </TooltipTrigger>
              <TooltipPortal>
                <TooltipContent>Risk ceiling</TooltipContent>
              </TooltipPortal>
            </Tooltip>
          )}
          {disabled ? (
            <SliderPrimitive.Thumb className="focus:outline-hidden block h-0 w-0" aria-label="Slider">
              <div
                className={`absolute ${(value?.[0] || 0) > 95 ? '-left-[20px]' : ''} -top-[0.5px] h-0 w-0 border-b-[11px] border-l-[5.5px] border-r-[5.5px] border-b-white border-l-transparent border-r-transparent`}
              />
            </SliderPrimitive.Thumb>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <SliderPrimitive.Thumb className="border-primary ring-offset-background focus-visible:ring-ring focus-visible:outline-hidden block cursor-pointer rounded-full border-8 bg-white transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50" />
              </TooltipTrigger>
              <TooltipPortal>
                <TooltipContent arrowPadding={10} className="max-w-75">
                  {isRepayMode
                    ? 'Risk can only be adjusted downwards when repaying. To adjust upwards, you can unstake SKY, or borrow more USDS on the Stake and Borrow tab.'
                    : 'Risk can only be adjusted upwards when borrowing. To adjust downwards, you can stake more SKY, or repay USDS on the Unstake and Repay tab.'}
                </TooltipContent>
              </TooltipPortal>
            </Tooltip>
          )}
        </SliderPrimitive.Root>
        <HStack className="justify-between px-4 pt-1">
          <Text variant="small">{leftLabel}</Text>
          <Text variant="small">{rightLabel}</Text>
        </HStack>
      </>
    );
  }
);
RiskSlider.displayName = SliderPrimitive.Root.displayName;

export { RiskSlider };
