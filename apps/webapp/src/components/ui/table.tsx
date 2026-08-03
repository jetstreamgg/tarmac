import * as React from 'react';

import { cn } from '@/lib/cn';
import { HTMLMotionProps, motion } from 'motion/react';
import { fadeAnimations } from '@/modules/ui/animation/presets';

// Design-system table (Figma Patterns/Tables 5178:37455). The construction is
// unusual: rows are separated by a 2px transparent gap (border-spacing, page
// background showing through) instead of borders, cells carry the row surface
// (bg-bgSecondary) so a row reads as one bar, and the *body* — not the table —
// is a 24px-radius surface, so the outer corners live on the first/last data
// row's edge cells. The header row is transparent and sits outside that
// surface. All columns are left-aligned per Figma, including numeric ones.

const Table = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement> & { className?: string; wrapperClassName?: string }
>(({ className, wrapperClassName, ...props }, ref) => (
  <div className={cn('relative w-full overflow-x-auto', wrapperClassName)}>
    <table
      ref={ref}
      className={cn(
        'w-full caption-bottom border-separate border-spacing-y-[2px]',
        '[&>tbody>tr:first-child>td:first-child]:rounded-tl-[24px] [&>tbody>tr:first-child>td:last-child]:rounded-tr-[24px] [&>tbody>tr:last-child>td:first-child]:rounded-bl-[24px] [&>tbody>tr:last-child>td:last-child]:rounded-br-[24px]',
        className
      )}
      {...props}
    />
  </div>
));
Table.displayName = 'Table';

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement> & { className?: string }
>(({ className, ...props }, ref) => <thead ref={ref} className={className} {...props} />);
TableHeader.displayName = 'TableHeader';

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement> & { className?: string }
>(({ className, ...props }, ref) => <tbody ref={ref} className={className} {...props} />);
TableBody.displayName = 'TableBody';

const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement> & { className?: string }
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn('bg-muted/50 border-t font-medium last:[&>tr]:border-b-0', className)}
    {...props}
  />
));
TableFooter.displayName = 'TableFooter';

const TableRow = React.forwardRef<HTMLTableRowElement, HTMLMotionProps<'tr'>>(
  ({ className, ...props }, ref) => (
    <motion.tr
      ref={ref}
      initial={false}
      // The hover/selected tint must land on the cells (the row surface), not
      // the tr: with border-separate a tr background would also paint under
      // the 2px slits and the corner radii wouldn't clip it.
      className={cn(
        'group/row',
        'has-[td]:hover:[&>td]:bg-bgTertiary data-[state=selected]:[&>td]:bg-bgTertiary',
        className
      )}
      variants={fadeAnimations}
      {...props}
    />
  )
);
TableRow.displayName = 'TableRow';

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement> & { className?: string }
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    // Body 6 label; 2px top + 12px bottom padding around the 18px line = the
    // 32px Figma header row. First column indents 28px (24px cell inset + 4
    // optical).
    className={cn(
      'text-fgSecondary font-graphik px-2 pt-0.5 pb-3 text-left align-middle text-xs leading-[18px] font-normal first:pl-7 [&:has([role=checkbox])]:pr-0',
      className
    )}
    {...props}
  />
));
TableHead.displayName = 'TableHead';

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement> & { className?: string }
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    // Label 5 / fg-primary is the default cell value type; typed cells
    // (table-cells.tsx) override locally. 24px first-column inset.
    className={cn(
      'bg-bgSecondary text-fgPrimary font-circle h-[88px] px-2 align-middle text-sm leading-4 font-medium tracking-[-0.28px] transition-colors first:pl-6 [&:has([role=checkbox])]:pr-0',
      className
    )}
    {...props}
  />
));
TableCell.displayName = 'TableCell';

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement> & { className?: string }
>(({ className, ...props }, ref) => (
  <caption ref={ref} className={cn('text-muted-foreground mt-4 text-sm', className)} {...props} />
));
TableCaption.displayName = 'TableCaption';

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption };
