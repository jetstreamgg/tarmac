import { useId } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';

// Design-system Loader (Figma Components/Loading 5018:27948, Loader family
// 5209:38588): the three-dot busy glyph, at the six documented diameters
// 2XS/XS/S/M/L/XL = 12/16/20/24/32/40px. The dot geometry is the static Figma
// asset (H4 first traced it for the button loading state); the staggered pulse
// makes it read as busy. Color rides currentColor so the loader inherits the
// surrounding text tone (buttons pass their label color, standalone loading
// states typically sit in fg-secondary containers); `brand` swaps the fill to
// the loader's brand gradient, the coloring the Figma asset itself carries
// (used by the selected wallet-list row, Patterns/Lists 5209:38763).
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
      <circle cx="2.667" cy="8.667" r="1.333" fill={fill} className="animate-pulse" />
      <circle cx="8" cy="6.667" r="1.333" fill={fill} className="animate-pulse [animation-delay:200ms]" />
      <circle
        cx="13.333"
        cy="8.667"
        r="1.333"
        fill={fill}
        className="animate-pulse [animation-delay:400ms]"
      />
    </svg>
  );
}
