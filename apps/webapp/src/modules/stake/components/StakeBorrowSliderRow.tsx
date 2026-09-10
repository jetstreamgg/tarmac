import { ReactNode } from 'react';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { formatBigInt } from '@/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Slider, SliderTicks } from '@/components/ui/slider';
import { StakeAmountSlider, STAKE_SLIDER_MAX } from '../hooks/useStakeAmountSlider';

const fmt = (amount: bigint) => formatBigInt(amount, { compact: true });

/**
 * Amount slider + its label row (Figma "Charts / Progress Steps"): end labels
 * for the axis bounds and, when the axis has an interior tick, its label
 * centered underneath (md+ only — on phones it would collide with the ends).
 */
export function StakeBorrowSliderRow({
  slider,
  mode,
  minLoading,
  maxLoading,
  unit,
  dataTestId
}: {
  slider: StakeAmountSlider;
  mode: 'borrow' | 'repay';
  minLoading?: boolean;
  maxLoading?: boolean;
  /** Trailing unit for the end labels (text or a token icon). */
  unit?: ReactNode;
  dataTestId: string;
}) {
  const { axis } = slider;
  const markerFraction = slider.markers[0] !== undefined ? slider.markers[0] / STAKE_SLIDER_MAX : undefined;
  const label = (children: ReactNode) => (
    <span className="flex items-center gap-1 whitespace-nowrap">
      {children}
      {unit}
    </span>
  );

  return (
    <div className="flex flex-col gap-2">
      <Slider
        variant="range"
        value={[slider.value]}
        max={STAKE_SLIDER_MAX}
        step={1}
        markers={slider.markers}
        disabled={slider.disabled}
        onValueChange={value => slider.onValueChange(value[0])}
        aria-label={mode === 'repay' ? t`Repay amount` : t`Borrow amount`}
        data-testid={dataTestId}
      />
      <div className="text-fgSecondary relative flex items-center gap-4 text-xs leading-[18px]">
        {mode === 'repay' ? (
          label(<Trans>Repay: {fmt(0n)}</Trans>)
        ) : minLoading ? (
          <Skeleton className="h-3.5 w-14" />
        ) : (
          label(<Trans>Min. {fmt(axis.min)}</Trans>)
        )}
        <SliderTicks variant="range" progress={slider.progress} className="grow" />
        {maxLoading ? (
          <Skeleton className="h-3.5 w-14" />
        ) : mode === 'repay' ? (
          label(<Trans>Repay: {fmt(axis.max)}</Trans>)
        ) : (
          label(<Trans>Max. {fmt(axis.max)}</Trans>)
        )}
        {markerFraction !== undefined && axis.marker !== undefined && (
          <span
            data-testid={`${dataTestId}-marker-label`}
            className="bg-bgTertiary/80 absolute top-full mt-0.5 -translate-x-1/2 rounded-md px-1 whitespace-nowrap backdrop-blur-[4px] max-md:hidden"
            style={{ left: `calc(8px + ${markerFraction} * (100% - 16px))` }}
          >
            {mode === 'repay' ? (
              <Trans>Repay: {fmt(axis.marker)}</Trans>
            ) : (
              <Trans>Borrowed: {fmt(axis.marker)}</Trans>
            )}
          </span>
        )}
      </div>
    </div>
  );
}
