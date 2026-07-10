import * as React from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { cn } from '@/lib/cn';

// App look — design-system sliders (Figma Sliders/Standard 5246:17832 ·
// Sliders/Range 5251:25493). `default` is the brand treatment: 2px track,
// #504dff→#757dff fill, 16px gradient thumb with a 1px white ring and a dark
// center dot. `range` is the risk treatment: 4px track, orange→yellow fill,
// amber thumb that greys out while the value sits at the minimum, and the
// 2×14 min/max markers pinned at the thumb-travel bounds.
type SliderVariant = 'default' | 'range';

function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  variant = 'default',
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root> & { variant?: SliderVariant }) {
  const _values = React.useMemo(
    () => (Array.isArray(value) ? value : Array.isArray(defaultValue) ? defaultValue : [min, max]),
    [value, defaultValue, min, max]
  );
  const isRange = variant === 'range';

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      // The Figma Range thumb turns fg-quaternary while nothing is staged
      // (Progress=Empty); the thumb reads this through the group.
      data-empty={_values.every(v => v <= min) || undefined}
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      className={cn(
        'group relative flex w-full touch-none items-center select-none data-[disabled]:opacity-50 data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-44 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col',
        className
      )}
      {...props}
    >
      <SliderPrimitive.Track
        data-slot="slider-track"
        className={cn(
          'bg-glassBadge relative grow overflow-hidden rounded-full data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full',
          isRange
            ? 'data-[orientation=horizontal]:h-1 data-[orientation=vertical]:w-1'
            : 'data-[orientation=horizontal]:h-0.5 data-[orientation=vertical]:w-0.5'
        )}
      >
        <SliderPrimitive.Range
          data-slot="slider-range"
          className={cn(
            'absolute rounded-full bg-linear-to-r data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full',
            isRange
              ? 'from-slider-yellow-start to-slider-yellow-end'
              : 'from-slider-brand-start to-slider-brand-end'
          )}
        />
      </SliderPrimitive.Track>
      {isRange && (
        // Min/max markers (2×14) centered on the thumb's end positions — the
        // thumb radius is 8px, so the 2px markers sit 7px in from each edge.
        <>
          <span
            aria-hidden
            className="bg-sliderMarker absolute top-1/2 left-[7px] h-3.5 w-0.5 -translate-y-1/2"
          />
          <span
            aria-hidden
            className="bg-sliderLine absolute top-1/2 right-[7px] h-3.5 w-0.5 -translate-y-1/2"
          />
        </>
      )}
      {Array.from({ length: _values.length }, (_, index) => (
        <SliderPrimitive.Thumb
          data-slot="slider-thumb"
          key={index}
          className={cn(
            'after:bg-sliderDot focus-visible:ring-focusRing relative block size-4 shrink-0 rounded-full transition-[color,box-shadow] after:absolute after:inset-1 after:rounded-full focus-visible:ring-1 focus-visible:ring-offset-0 focus-visible:outline-hidden disabled:pointer-events-none',
            isRange
              ? 'bg-sliderAmber group-data-[empty]:bg-fgQuaternary'
              : 'border-sliderRing from-slider-brand-start to-slider-brand-end border bg-linear-to-b'
          )}
        />
      ))}
    </SliderPrimitive.Root>
  );
}

// The tick scale that sits under a Slider in both Figma families (the dashed
// row running between the min/max labels). The colored share follows
// `progress` (0–100). The pattern is a full-width fill revealed through a
// repeating 1px mask, so tick density stays fixed while the colored width
// tracks the value — tick pitch and height measured off the Figma frames
// (Standard: 1×4 every 8.2px · Range: 1×8 every 5.6px).
function SliderTicks({
  progress,
  variant = 'default',
  className
}: {
  /** Colored share of the scale, 0–100 (same domain as the slider value). */
  progress: number;
  variant?: SliderVariant;
  className?: string;
}) {
  const isRange = variant === 'range';
  const mask = isRange
    ? '[mask-image:repeating-linear-gradient(to_right,black_0_1px,transparent_1px_5.6px)]'
    : '[mask-image:repeating-linear-gradient(to_right,black_0_1px,transparent_1px_8.2px)]';
  return (
    <div aria-hidden className={cn('relative overflow-hidden', isRange ? 'h-2' : 'h-1', className)}>
      <div className={cn('bg-glassBadge absolute inset-0', mask)} />
      <div
        className={cn(
          'absolute inset-y-0 left-0 bg-linear-to-r',
          mask,
          isRange
            ? 'from-slider-yellow-start to-slider-yellow-end'
            : 'from-slider-brand-start to-slider-brand-end'
        )}
        style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
      />
    </div>
  );
}

export { Slider, SliderTicks };
