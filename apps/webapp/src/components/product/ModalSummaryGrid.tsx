import { Fragment, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { CardField, CardFieldDivider, CardFieldRow } from './CardFields';

export type ModalSummaryCell = {
  label: ReactNode;
  content: ReactNode;
  testId?: string;
};

/**
 * Transaction-modal detail grid (Figma 859:36056 entry / 859:36168 review):
 * rows of one full-width or two equal-column labelled cells, split by a
 * centered vertical hairline and separated by horizontal ones. Cells are the
 * shared CardField trio; callers compose the values (token icons, deltas, the
 * savings-green %) into `content`.
 */
export function ModalSummaryGrid({
  rows,
  dividerClassName,
  className
}: {
  rows: ModalSummaryCell[][];
  /** Vertical-hairline override — the entry screen draws 32px (`h-8`), the review 24px (`h-6`). */
  dividerClassName?: string;
  className?: string;
}) {
  return (
    <div className={cn('flex w-full flex-col gap-4', className)}>
      {rows.map((row, i) => (
        <Fragment key={i}>
          {i > 0 && <div className="border-borderPrimary border-t" aria-hidden />}
          <CardFieldRow>
            {row.map((cell, j) => (
              <Fragment key={j}>
                {j > 0 && <CardFieldDivider className={cn('h-8', dividerClassName)} />}
                <CardField label={cell.label} testId={cell.testId}>
                  {cell.content}
                </CardField>
              </Fragment>
            ))}
          </CardFieldRow>
        </Fragment>
      ))}
    </div>
  );
}
