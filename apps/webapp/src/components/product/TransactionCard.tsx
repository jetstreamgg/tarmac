import { ReactNode } from 'react';
import { ExternalLink } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';

/**
 * Mobile stand-in for a transactions-table row (Figma mobile Table Section
 * cards, 486:20827 / 486:20198): bg-secondary surface, 20px padding, 24px
 * between header / field grid / footer. Fields lay out two per row — a 112px
 * left column and a flexible right one split by a hairline — with Body 6
 * labels over Label 5 values, matching the desktop typed cells.
 *
 * Corners stay square on purpose: the comp stacks cards flush with 2px gaps
 * (the desktop table's border-spacing) and rounds only the list's outer
 * corners, so the list container owns the radius — same scheme as ui/table.
 */

export type TransactionCardField = { label: ReactNode; value: ReactNode };

function Field({
  field,
  className,
  valueClassName
}: {
  field: TransactionCardField;
  className?: string;
  valueClassName?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <span className="font-graphik text-fgSecondary text-xs leading-[18px]">{field.label}</span>
      <span
        className={cn(
          'font-circle text-fgPrimary flex min-h-4 items-center text-sm leading-4 font-medium tracking-[-0.28px]',
          valueClassName
        )}
      >
        {field.value}
      </span>
    </div>
  );
}

/** The card's 2-per-row label/value grid — also the accordion cards' detail body. */
export function TransactionCardFieldGrid({
  fields,
  valueClassName
}: {
  fields: TransactionCardField[];
  /** Value override for consumers whose comps step off Label 5 (e.g. the M6.2 accordion's Label 6). */
  valueClassName?: string;
}) {
  const rows: TransactionCardField[][] = [];
  for (let i = 0; i < fields.length; i += 2) rows.push(fields.slice(i, i + 2));

  return (
    <div className="flex w-full flex-col gap-3">
      {rows.map((pair, index) => (
        <div key={index} className="flex w-full items-center gap-5">
          <Field field={pair[0]} className="w-28 shrink-0" valueClassName={valueClassName} />
          {pair[1] && (
            <>
              <div className="bg-glassBorder h-[30px] w-px shrink-0" aria-hidden />
              <Field field={pair[1]} className="min-w-0 flex-1" valueClassName={valueClassName} />
            </>
          )}
        </div>
      ))}
    </div>
  );
}

export function TransactionCard({
  header,
  badge,
  fields = [],
  link,
  footer
}: {
  /** Left header content — typically the table's CellAction (icon + verb + time). */
  header: ReactNode;
  /** Optional right header slot — typically CellStatus. */
  badge?: ReactNode;
  fields?: TransactionCardField[];
  /** Footer "View transaction ↗" secondary button. */
  link?: { label: ReactNode; href: string };
  /** Free-form footer slot for non-link CTAs (used instead of `link`). */
  footer?: ReactNode;
}) {
  return (
    <div className="bg-bgSecondary flex w-full flex-col gap-6 p-5 backdrop-blur-[20px]">
      <div className="flex items-center justify-between gap-3">
        {header}
        {badge}
      </div>
      {fields.length > 0 && <TransactionCardFieldGrid fields={fields} />}
      {link && (
        <Button asChild variant="secondary" size="m" className="w-full">
          <a href={link.href} target="_blank" rel="noreferrer" onClick={event => event.stopPropagation()}>
            {/* Real element, not a bare text node: Chrome skips flex `gap`
                between an anonymous text item and the icon. */}
            <span>{link.label}</span>
            <ExternalLink aria-hidden />
          </a>
        </Button>
      )}
      {footer}
    </div>
  );
}
