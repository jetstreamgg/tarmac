import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** The brand-gradient accent phrase used inside banner headings (Figma #949aff→#504dff). */
export function BannerAccent({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn('bg-gradient-to-b from-[#949aff] to-[#504dff] bg-clip-text text-transparent', className)}
    >
      {children}
    </span>
  );
}

/**
 * DS Patterns/Banners (Figma 5273:45498): a wide promo banner — a 160px
 * illustration, a heading (optionally with a `BannerAccent` gradient phrase)
 * over a Body-6 subtitle, and a CTA. Presentational; the caller supplies the
 * illustration, copy, and action. Stacks on mobile, rows from md.
 */
export function PromoBanner({
  illustration,
  heading,
  subtitle,
  action,
  className,
  illustrationClassName,
  dataTestId
}: {
  illustration: ReactNode;
  heading: ReactNode;
  subtitle: ReactNode;
  action: ReactNode;
  className?: string;
  /** Overrides the 160px illustration slot (e.g. the connect card's 96px mobile tier). */
  illustrationClassName?: string;
  dataTestId?: string;
}) {
  return (
    <div
      data-testid={dataTestId}
      className={cn(
        'bg-bgSecondary flex flex-col items-start gap-6 rounded-[28px] p-6 backdrop-blur-[20px]',
        'md:flex-row md:items-center md:gap-8 md:py-5 md:pr-12 md:pl-8',
        className
      )}
    >
      <div className={cn('size-40 shrink-0', illustrationClassName)}>{illustration}</div>
      <div className="flex min-w-px flex-1 flex-col items-start gap-3">
        {heading}
        {subtitle}
      </div>
      {action}
    </div>
  );
}
