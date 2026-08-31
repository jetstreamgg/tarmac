import * as React from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { cn } from '@/lib/cn';

// App look — design-system sliders (Figma Sliders/Standard 5246:17832 ·
// Sliders/Range 5251:25493). `default` is the brand treatment: 4px track,
// #504dff→#757dff fill, 16px gradient thumb with a 1px white ring and an 8px
// center dot. `range` is the risk treatment: same 4px track, orange→yellow
// fill, amber thumb that greys out while the value sits at the minimum, and
// the 2×14 min/max markers pinned at the thumb-travel bounds.
//
// Both track and dot were a step small (2px / 6px) against the DS
// (5051:165992, APP-443 item 17).
type SliderVariant = 'default' | 'range';

function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  variant = 'default',
  valueText,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root> & {
  variant?: SliderVariant;
  /** Spoken value for the thumb (aria-valuetext) — e.g. "25%" where the bare
   *  number would be ambiguous. Radix puts role="slider" on the THUMB, so this
   *  cannot be passed through Root's props. */
  valueText?: string;
}) {
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
      // Radix absolutely positions the thumb, so the root's flow height is
      // just the 2-4px track — a near-impossible click target. The before
      // overlay stretches it 12px past the root on both sides without moving
      // layout; pointer events on it hit-test to the root, where Radix's
      // click-to-jump listener lives.
      className={cn(
        'group relative flex w-full cursor-pointer touch-none items-center select-none before:absolute before:inset-x-0 before:-inset-y-3 data-[disabled]:opacity-50 data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-44 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col',
        className
      )}
      {...props}
    >
      <SliderPrimitive.Track
        data-slot="slider-track"
        className="bg-glassBadge relative grow overflow-hidden rounded-full data-[orientation=horizontal]:h-1 data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1"
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
          aria-valuetext={valueText}
          className={cn(
            // inset-[3px] not inset-1: the thumb's 1px border shrinks the
            // padding box the ::after insets resolve against to 14px, so a 4px
            // inset left a 6px dot where the DS draws 8.
            'after:bg-sliderDot focus-visible:ring-focusRing relative block size-4 shrink-0 rounded-full transition-[color,box-shadow] after:absolute after:inset-[3px] after:rounded-full focus-visible:ring-1 focus-visible:ring-offset-0 focus-visible:outline-hidden disabled:pointer-events-none',
            isRange
              ? 'bg-sliderAmber group-data-[empty]:bg-fgQuaternary'
              : // bg-origin-border spans the gradient across the border box: the
                // translucent ring must blend over the local gradient color; by
                // default the gradient tiles from the padding box, wrapping the
                // opposite end's color into the ring (same fix as button.tsx).
                'border-sliderRing from-slider-brand-start to-slider-brand-end border bg-linear-to-b bg-origin-border'
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

  // The ticks row usually sits between the min/max labels, so it's narrower
  // than and offset from the Slider above — mapping `progress` straight to a
  // width leaves the colored boundary drifting off the thumb (ahead near min,
  // behind near max). The Figma Progress variants pin the boundary under the
  // thumb, so measure the row's inset within its parent (which shares the
  // slider's width — both are laid out in the same column) and project the
  // thumb-center position (8px radius inset at each end) into tick space.
  const ref = React.useRef<HTMLDivElement>(null);
  const [geometry, setGeometry] = React.useState<{
    offset: number;
    width: number;
    sliderWidth: number;
  } | null>(null);

  React.useLayoutEffect(() => {
    const el = ref.current;
    const row = el?.parentElement;
    if (!el || !row) return;
    const measure = () => {
      const elRect = el.getBoundingClientRect();
      const rowRect = row.getBoundingClientRect();
      setGeometry({
        offset: elRect.left - rowRect.left,
        width: elRect.width,
        sliderWidth: rowRect.width
      });
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(row);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const fraction = Math.min(100, Math.max(0, progress)) / 100;
  const percent =
    geometry && geometry.width > 0
      ? ((8 + fraction * (geometry.sliderWidth - 16) - geometry.offset) / geometry.width) * 100
      : fraction * 100;

  return (
    <div ref={ref} aria-hidden className={cn('relative overflow-hidden', isRange ? 'h-2' : 'h-1', className)}>
      <div className={cn('bg-glassBadge absolute inset-0', mask)} />
      <div
        className={cn(
          'absolute inset-y-0 left-0 bg-linear-to-r',
          mask,
          isRange
            ? 'from-slider-yellow-start to-slider-yellow-end'
            : 'from-slider-brand-start to-slider-brand-end'
        )}
        style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
      />
    </div>
  );
}

export { Slider, SliderTicks };
