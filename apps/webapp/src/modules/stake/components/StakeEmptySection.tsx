import { ReactNode } from 'react';
import { EmptyState } from '@/components/ui/empty-state';

/**
 * My positions empty section (APP-600, comp 3617:23840): the Heading 6 title
 * sits outside a 320px dashed box that centers the 48px illustration and copy.
 */
export function StakeEmptySection({
  testId,
  title,
  illustration,
  children
}: {
  testId: string;
  title: ReactNode;
  /** DS empty illustration; sized to 48px here. */
  illustration: ReactNode;
  children: ReactNode;
}) {
  return (
    <section data-testid={testId} className="flex flex-col gap-6">
      <h3 className="text-fgPrimary font-circle text-lg leading-[22px] font-medium tracking-[-0.36px] md:text-xl md:tracking-[-0.4px]">
        {title}
      </h3>
      <div className="border-glassBorder flex h-80 items-center justify-center rounded-[28px] border border-dashed">
        <EmptyState illustration={illustration} className="py-0 [&>svg]:size-12">
          {children}
        </EmptyState>
      </div>
    </section>
  );
}
