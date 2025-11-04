import * as React from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { Text } from '@widgets/shared/components/ui/Typography';
import { cn } from '@widgets/lib/utils';
import { HStack } from './layout/HStack';
import { Tooltip, TooltipContent, TooltipPortal, TooltipTrigger } from '@widgets/components/ui/tooltip';
import { getTooltipsByIds } from '@widgets/data/tooltips';
import { DragArrows } from '../icons/DragArrows';
import { RISK_LEVEL_THRESHOLDS, RiskLevel } from '@jetstreamgg/sky-hooks';

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
};

const RISK_INDICATOR_SIZE = 10;

// Extract risk level thresholds in a single pass
const riskThresholds = RISK_LEVEL_THRESHOLDS.reduce(
  (acc, { level, threshold }) => {
    acc[level] = threshold;
    return acc;
  },
  {} as Record<RiskLevel, number>
);

// Map risk level thresholds to gradient colors
// LOW (0-25) -> green, MEDIUM (25-40) -> amber, HIGH (40-80) -> orange, LIQUIDATION (80-100) -> red
const GRADIENT_COLORS = [
  { stop: riskThresholds[RiskLevel.LOW], rgb: { r: 74, g: 222, b: 128 } }, // green
  { stop: riskThresholds[RiskLevel.MEDIUM], rgb: { r: 251, g: 191, b: 36 } }, // amber
  { stop: riskThresholds[RiskLevel.HIGH], rgb: { r: 248, g: 113, b: 113 } }, // orange
  { stop: riskThresholds[RiskLevel.LIQUIDATION], rgb: { r: 239, g: 68, b: 68 } } // red
];

const rgbToString = (rgb: { r: number; g: number; b: number }) => `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;

const CSS_GRADIENT = `linear-gradient(to right, ${GRADIENT_COLORS.map(
  ({ stop, rgb }) => `${rgbToString(rgb)} ${stop}%`
).join(', ')})`;

const calculateColor = (
  from: { r: number; g: number; b: number },
  to: { r: number; g: number; b: number },
  t: number
) => {
  const r = Math.round(from.r + (to.r - from.r) * t);
  const g = Math.round(from.g + (to.g - from.g) * t);
  const b = Math.round(from.b + (to.b - from.b) * t);
  return rgbToString({ r, g, b });
};

const getGradientColorAtPercentage = (percentage: number): string => {
  if (percentage <= GRADIENT_COLORS[0].stop)
    return calculateColor(GRADIENT_COLORS[0].rgb, GRADIENT_COLORS[0].rgb, 0);
  if (percentage >= GRADIENT_COLORS[GRADIENT_COLORS.length - 1].stop) {
    const lastColor = GRADIENT_COLORS[GRADIENT_COLORS.length - 1].rgb;
    return calculateColor(lastColor, lastColor, 0);
  }

  for (let i = 0; i < GRADIENT_COLORS.length - 1; i++) {
    const current = GRADIENT_COLORS[i];
    const next = GRADIENT_COLORS[i + 1];

    if (percentage >= current.stop && percentage <= next.stop) {
      const t = (percentage - current.stop) / (next.stop - current.stop);
      return calculateColor(current.rgb, next.rgb, t);
    }
  }

  return calculateColor(GRADIENT_COLORS[0].rgb, GRADIENT_COLORS[0].rgb, 0);
};

// Fetch tooltips for the risk slider
const [
  riskSliderBorrowTooltip,
  riskSliderRepayTooltip,
  maxPermittedRiskTooltip,
  riskFloorTooltip,
  riskCeilingTooltip
] = getTooltipsByIds(['risk-borrow', 'risk-repay', 'max-permitted-risk', 'risk-floor', 'risk-ceiling']);

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
      ...props
    },
    ref
  ) => {
    const [localValue, setLocalValue] = React.useState(value);

    const isBorrowMode = currentRiskFloor !== undefined && currentRiskCeiling === undefined;
    const isRepayMode = currentRiskCeiling !== undefined && currentRiskFloor === undefined;
    const isCreateMode = !isBorrowMode && !isRepayMode;

    const thumbTooltipContent = isCreateMode
      ? undefined // no tooltip for create mode
      : isBorrowMode
        ? riskSliderBorrowTooltip?.tooltip
        : isRepayMode
          ? riskSliderRepayTooltip?.tooltip
          : undefined;

    const thumbClassName =
      'border-primary ring-offset-background focus-visible:ring-ring focus-visible:outline-hidden block cursor-pointer rounded-full bg-white transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 w-5 h-5';

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
      const thumbSize = 20; // Radix thumb size
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
              background: trackColor || CSS_GRADIENT
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
                <TooltipContent side="right" className="max-w-xs">
                  <p className="text-sm font-medium text-white">{maxPermittedRiskTooltip?.title}</p>
                  <p className="mt-2 text-xs text-gray-400">{maxPermittedRiskTooltip?.tooltip}</p>
                </TooltipContent>
              </TooltipPortal>
            </Tooltip>
          )}
          {currentRiskFloor !== undefined &&
            (() => {
              const bgColor = trackColor || getGradientColorAtPercentage(currentRiskFloor);
              return (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className="absolute top-1/2 -translate-y-1/2 transform rounded-full"
                      style={{
                        left: `calc(${currentRiskFloor}% + ${calculateOffset(currentRiskFloor)}px)`,
                        transform: 'translateX(-50%)',
                        backgroundColor: bgColor,
                        height: `${indicatorSize}px`,
                        width: `${indicatorSize}px`
                      }}
                    />
                  </TooltipTrigger>
                  <TooltipPortal>
                    <TooltipContent side="right" className="max-w-xs">
                      <p className="text-sm font-medium text-white">{riskFloorTooltip?.title}</p>
                      <p className="mt-2 text-xs text-gray-400">{riskFloorTooltip?.tooltip}</p>
                    </TooltipContent>
                  </TooltipPortal>
                </Tooltip>
              );
            })()}
          {currentRiskCeiling !== undefined &&
            (() => {
              const bgColor = trackColor || getGradientColorAtPercentage(currentRiskCeiling);
              return (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className="absolute top-1/2 -translate-y-1/2 transform rounded-full"
                      style={{
                        left: `calc(${currentRiskCeiling}% + ${calculateOffset(currentRiskCeiling)}px)`,
                        transform: 'translateX(-50%)',
                        backgroundColor: bgColor,
                        height: `${indicatorSize}px`,
                        width: `${indicatorSize}px`
                      }}
                    />
                  </TooltipTrigger>
                  <TooltipPortal>
                    <TooltipContent side="right" className="max-w-xs">
                      <p className="text-sm font-medium text-white">{riskCeilingTooltip?.title}</p>
                      <p className="mt-2 text-xs text-gray-400">{riskCeilingTooltip?.tooltip}</p>
                    </TooltipContent>
                  </TooltipPortal>
                </Tooltip>
              );
            })()}
          {disabled ? (
            <SliderPrimitive.Thumb className="focus:outline-hidden block h-0 w-0" aria-label="Slider">
              <div
                className={`absolute ${(value?.[0] || 0) > 95 ? '-left-[20px]' : ''} -top-[0.5px] h-0 w-0 border-b-[11px] border-l-[5.5px] border-r-[5.5px] border-b-white border-l-transparent border-r-transparent`}
              />
            </SliderPrimitive.Thumb>
          ) : thumbTooltipContent ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <SliderPrimitive.Thumb className={thumbClassName}>
                  <DragArrows width={20} height={20} />
                </SliderPrimitive.Thumb>
              </TooltipTrigger>
              <TooltipPortal>
                <TooltipContent side="top" className="max-w-[280px] whitespace-normal text-left">
                  {thumbTooltipContent}
                </TooltipContent>
              </TooltipPortal>
            </Tooltip>
          ) : isCreateMode ? (
            <SliderPrimitive.Thumb className={thumbClassName}>
              <DragArrows width={20} height={20} />
            </SliderPrimitive.Thumb>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <SliderPrimitive.Thumb className={thumbClassName}>
                  <DragArrows width={20} height={20} />
                </SliderPrimitive.Thumb>
              </TooltipTrigger>
              <TooltipPortal>
                <TooltipContent arrowPadding={10} className="max-w-75">
                  {isRepayMode ? riskSliderRepayTooltip?.tooltip : riskSliderBorrowTooltip?.tooltip}
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
