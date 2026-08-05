import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * The DS "nothing here yet" block: an illustration above a short, centered
 * message (comps 1036:208676 / 1036:208685). Stake shipped this by hand in two
 * places; Portfolio's sections and the shared transactions table now render the
 * same thing rather than a bare line of text.
 *
 * The 224px cap is what makes the copy wrap onto two balanced lines in the
 * comp — it is part of the design, not a guard against overflow.
 */
export function EmptyState({
  illustration,
  children,
  className
}: {
  /** 64px DS empty illustration, e.g. `<SuppliedEmpty />`. */
  illustration: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center gap-4 py-6', className)}>
      {illustration}
      <p className="text-fgSecondary font-circle max-w-[224px] text-center text-sm leading-4 font-medium tracking-[-0.28px]">
        {children}
      </p>
    </div>
  );
}
