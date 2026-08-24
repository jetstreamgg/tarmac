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
export function RateBadge({
  children,
  className,
  ...props
}: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      {...props}
      className={cn(
        'border-success-gradient-start from-success-gradient-start/10 to-success-gradient-end/10 inline-flex shrink-0 items-center rounded-full border-[0.5px] bg-linear-to-b px-1.5 py-[3px]',
        className
      )}
    >
      <span className="font-circle from-success-gradient-start to-success-gradient-end bg-linear-to-b bg-clip-text text-[11px] leading-3 font-medium tracking-[-0.24px] text-transparent md:text-xs md:leading-[14px]">
        {children}
      </span>
    </span>
  );
}
