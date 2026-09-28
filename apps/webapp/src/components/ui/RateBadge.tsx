import type * as React from 'react';
import { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Design-system Badges / Special (Figma 5051:164977, e.g. 1369:45498): the
 * green rate pill that tags a product's headline rate. A hairline
 * system-success border over a 10%-alpha wash of the same success gradient,
 * with the label itself painted in that gradient.
 *
 * The gradient carries no light mode in Figma — both themes take these stops,
 * same call as `success-gradient-start/end`'s other consumers.
 *
 * Type is Label 6 (Circular Medium 12/14, -0.24) from md, one step down on the
 * phone tier where every comp that draws it is tighter.
 */
/**
 * The label's gradient paint, on its own for a child that has to carry it
 * itself: `background-clip: text` never reaches a transformed descendant, so
 * a figure that rolls (`RollingValue`) declares this on each glyph.
 */
export const RATE_BADGE_GRADIENT_TEXT_CLASSES =
  'from-success-gradient-start to-success-gradient-end bg-linear-to-b bg-clip-text text-transparent';

export function RateBadge({
  children,
  className,
  tone = 'success',
  ...props
}: {
  children: ReactNode;
  className?: string;
  /** `error` mirrors the pill's geometry in the error token for a falling
   *  figure (the chart trend badge). One element for both directions so a
   *  sign change restyles in place instead of remounting whatever rolls
   *  inside. */
  tone?: 'success' | 'error';
} & React.HTMLAttributes<HTMLSpanElement>) {
  const isError = tone === 'error';
  return (
    <span
      {...props}
      className={cn(
        'inline-flex shrink-0 items-center rounded-full border-[0.5px] px-1.5 py-[3px]',
        isError
          ? 'border-error/50 bg-error/10'
          : 'border-success-gradient-start from-success-gradient-start/10 to-success-gradient-end/10 bg-linear-to-b',
        className
      )}
    >
      <span
        className={cn(
          'font-circle text-[11px] leading-3 font-medium tracking-[-0.24px] md:text-xs md:leading-[14px]',
          isError ? 'text-error' : RATE_BADGE_GRADIENT_TEXT_CLASSES
        )}
      >
        {children}
      </span>
    </span>
  );
}
