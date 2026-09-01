import { useId } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';

// Design-system Loader (Figma Components/Loading 5018:27948, Loader family
// 5209:38588; motion 2238:62221): the three-dot busy glyph, at the six
// documented diameters 2XS/XS/S/M/L/XL = 12/16/20/24/32/40px. The comp draws
// a dot as a sixth of the box with a dot-wide gap between them, so in the
// 16-unit viewBox each dot is 2.67 across and the row is centred at y=8. The
// dots hop in sequence (see `--animate-loader-dot`); the old static asset was
// a single frame of that hop, which is why its middle dot sat higher. Color
// rides currentColor so the loader inherits the surrounding text tone;
// `brand` swaps the fill to the loader's brand gradient, the coloring the
// Figma asset itself carries (used by the selected wallet-list row,
// Patterns/Lists 5209:38763).
const loaderVariants = cva('shrink-0', {
  variants: {
    size: {
      '2xs': 'size-3',
      xs: 'size-4',
      s: 'size-5',
      m: 'size-6',
      l: 'size-8',
      xl: 'size-10'
    }
  },
  defaultVariants: {
    size: 'm'
  }
});

export type LoaderSize = NonNullable<VariantProps<typeof loaderVariants>['size']>;

// Stagger between dots: 100ms of the 1.6s loop (Figma 2238:62221).
const DOT_STAGGER_MS = 100;
const DOT_CENTERS = [2.667, 8, 13.333];

export function Loader({
  size,
  brand = false,
  className
}: VariantProps<typeof loaderVariants> & { brand?: boolean; className?: string }) {
  const gradientId = useId();
  const fill = brand ? `url(#${gradientId})` : 'currentColor';
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      data-testid="loader"
      className={cn(loaderVariants({ size }), className)}
    >
      {brand && (
        <defs>
          <linearGradient id={gradientId} x1="8" y1="5.333" x2="8" y2="10" gradientUnits="userSpaceOnUse">
            <stop stopColor="var(--color-loader-brand-start)" />
            <stop offset="1" stopColor="var(--color-loader-brand-end)" />
          </linearGradient>
        </defs>
      )}
      {/* Reduced motion keeps the glyph legible as "busy" with the old opacity
          pulse instead of the hop. `will-change` isn't needed: a transform on an
          SVG leaf is already composited off the text layer. */}
      {DOT_CENTERS.map((cx, index) => (
        <circle
          key={cx}
          cx={cx}
          cy="8"
          r="1.333"
          fill={fill}
          className="motion-safe:animate-loader-dot motion-reduce:animate-pulse"
          style={{ animationDelay: `${index * DOT_STAGGER_MS}ms` }}
        />
      ))}
    </svg>
  );
}
