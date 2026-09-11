import { ReactNode, useLayoutEffect, useRef, useState } from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { cn } from '@/lib/cn';
import { formatBigInt } from '@/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { StakeAmountSlider, STAKE_SLIDER_MAX } from '../hooks/useStakeAmountSlider';

// Figma draws grouped whole numbers ("56,201"), not compact ("56.2K").
const fmt = (amount: bigint) => formatBigInt(amount, { maxDecimals: 0 });
const pct = (position: number) => `${position / (STAKE_SLIDER_MAX / 100)}%`;

/** Body 7 prefix + Label 6 value, 3px apart (Figma 3015:62374). */
function AxisLabel({ prefix, value }: { prefix: ReactNode; value: ReactNode }) {
  return (
    <span className="flex items-center gap-[3px] whitespace-nowrap">
      <span className="text-fgTertiary text-[11px] leading-4">{prefix}</span>
      <span className="text-fgSecondary font-circle text-xs leading-[14px] font-medium tracking-[-0.24px]">
        {value}
      </span>
    </span>
  );
}

/**
 * Figma "Charts / Progress Steps" (3015:60998 borrow · 3015:62128 repay ·
 * 3015:62365 borrow-more): a 12px bg-tertiary bar carrying the gradient fill
 * (8px stub at zero) with a 2px black marker 3px inside its end and the label
 * row 12px below. Repay dots the partial-repay zone (up to debt − dust) every
 * 6.64px plus one end dot; borrow has none. Borrow-more shades the
 * already-borrowed share, runs a 1px tick through the current debt and colours
 * only the staged delta. The fill colour is the resulting liquidation risk
 * (green when Low, yellow otherwise; 3015:59485 vs 3015:59343). The bar stays
 * a Radix slider (drag/keyboard); the thumb is an invisible focus anchor and
 * the bar takes the focus ring.
 */
export function StakeBorrowSliderRow({
  slider,
  mode,
  tone,
  minLoading,
  maxLoading,
  dataTestId
}: {
  slider: StakeAmountSlider;
  mode: 'borrow' | 'repay';
  /** Resulting risk: green when Low, yellow for everything else. */
  tone: 'green' | 'yellow';
  minLoading?: boolean;
  maxLoading?: boolean;
  dataTestId: string;
}) {
  const { axis, disabled } = slider;
  const isBorrow = mode === 'borrow';
  const marker = slider.markers[0];
  const labelRow = useRef<HTMLDivElement>(null);
  const [tickLabelHidden, setTickLabelHidden] = useState(false);
  // A tick label near an end would print over the end label; measure and hide it.
  useLayoutEffect(() => {
    const row = labelRow.current;
    if (!row || marker === undefined) return;
    const check = () => {
      const [min, max, tick] = ['min', 'max', 'marker'].map(k =>
        row.querySelector(`[data-testid="${dataTestId}-${k}-label"]`)?.getBoundingClientRect()
      );
      if (!tick || !min || !max) return;
      setTickLabelHidden(tick.left < min.right + 8 || tick.right > max.left - 8);
    };
    check();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(check);
    observer.observe(row);
    return () => observer.disconnect();
  }, [marker, axis.min, axis.max, axis.marker, dataTestId]);
  const fillStart = isBorrow && marker !== undefined ? marker : 0;
  const fillEnd = Math.max(fillStart, slider.value);
  const fillStyle = disabled
    ? { left: 0, width: '100%' }
    : { left: pct(fillStart), width: `max(8px, ${pct(fillEnd - fillStart)})` };

  return (
    <div className="flex flex-col gap-3">
      <SliderPrimitive.Root
        data-slot="slider"
        value={[slider.value]}
        max={STAKE_SLIDER_MAX}
        step={1}
        disabled={disabled}
        onValueChange={value => slider.onValueChange(value[0])}
        // Radix stays silent when End lands on an already-pinned (over-typed) thumb.
        onKeyDown={event => {
          if (event.key === 'End' && slider.value >= STAKE_SLIDER_MAX && !disabled) {
            slider.onValueChange(STAKE_SLIDER_MAX);
          }
        }}
        aria-label={isBorrow ? t`Borrow amount` : t`Repay amount`}
        data-testid={dataTestId}
        // The before overlay pads the 12px hit target by 12px each side.
        className="relative flex h-3 w-full cursor-pointer touch-none items-center select-none before:absolute before:inset-x-0 before:-inset-y-3 data-[disabled]:cursor-default"
      >
        <SliderPrimitive.Track
          data-slot="slider-track"
          className="bg-bgTertiary has-focus-visible:ring-focusRing relative h-3 w-full grow overflow-hidden rounded-[4px] has-focus-visible:ring-1"
        >
          {isBorrow && marker !== undefined && !disabled && (
            // Already-borrowed share: raw #090420 at 35% in the comp, no variable.
            <span
              aria-hidden
              data-slot="slider-borrowed"
              className="absolute inset-y-0 left-0 rounded-[4px] bg-[#090420]/35"
              style={{ width: pct(marker) }}
            />
          )}
          <span
            aria-hidden
            data-slot="slider-fill"
            className={cn(
              'absolute inset-y-0 rounded-[4px] bg-linear-to-r',
              tone === 'green'
                ? 'from-slider-green-start to-slider-green-end'
                : 'from-slider-yellow-start to-slider-yellow-end',
              // Nothing to stage: a flat fg-quaternary bar (3015:62546).
              disabled && 'bg-fgQuaternary bg-none'
            )}
            style={fillStyle}
          >
            <span
              data-slot="slider-fill-marker"
              // Disabled comp binds the marker to fg-primary-inverse (#090420), no project token.
              className={cn(
                'absolute inset-y-0.5 right-[3px] w-0.5 rounded-[30px]',
                disabled ? 'bg-[#090420]' : 'bg-black'
              )}
            />
          </span>
          {!isBorrow && (
            <>
              {marker !== undefined && (
                <span
                  aria-hidden
                  data-slot="slider-dots"
                  className="absolute top-[5px] left-[3px] h-0.5 [background-image:radial-gradient(circle_at_1px_1px,var(--color-bgTertiary)_1px,transparent_1px)] [background-size:6.64px_2px]"
                  style={{ width: pct(marker) }}
                />
              )}
              <span
                aria-hidden
                data-slot="slider-end-dot"
                className="bg-bgTertiary absolute top-[5px] right-[3px] size-0.5 rounded-full"
              />
            </>
          )}
        </SliderPrimitive.Track>
        {isBorrow && marker !== undefined && !disabled && (
          <span
            aria-hidden
            data-slot="slider-marker"
            className="bg-sliderMarker absolute -inset-y-[3px] w-px -translate-x-1/2"
            style={{ left: pct(marker) }}
          />
        )}
        <SliderPrimitive.Thumb
          data-slot="slider-thumb"
          className="block size-0 focus-visible:outline-hidden"
        />
      </SliderPrimitive.Root>

      <div ref={labelRow} className="relative flex h-4 items-center justify-between">
        <span data-testid={`${dataTestId}-min-label`}>
          {isBorrow ? (
            minLoading ? (
              <Skeleton className="h-3.5 w-14" />
            ) : slider.atFloor ? (
              // Debt on the floor: no interior tick, so the end label carries it.
              <AxisLabel prefix={<Trans>Borrowed:</Trans>} value={t`${fmt(axis.min)} (Min.)`} />
            ) : (
              <AxisLabel prefix={<Trans>Min.</Trans>} value={fmt(axis.min)} />
            )
          ) : (
            <AxisLabel prefix={<Trans>Repay:</Trans>} value="0.00" />
          )}
        </span>
        <span data-testid={`${dataTestId}-max-label`}>
          {maxLoading ? (
            <Skeleton className="h-3.5 w-14" />
          ) : (
            <AxisLabel
              prefix={isBorrow ? <Trans>Max.</Trans> : <Trans>Repay:</Trans>}
              value={fmt(axis.max)}
            />
          )}
        </span>
        {marker !== undefined && axis.marker !== undefined && (
          // Centered under the interior tick; phones have no room between the ends.
          <span
            data-testid={`${dataTestId}-marker-label`}
            className={cn('absolute top-0 -translate-x-1/2 max-md:hidden', tickLabelHidden && 'invisible')}
            style={{ left: pct(marker) }}
          >
            <AxisLabel
              prefix={isBorrow ? <Trans>Borrowed:</Trans> : <Trans>Repay:</Trans>}
              value={fmt(axis.marker)}
            />
          </span>
        )}
      </div>
    </div>
  );
}
