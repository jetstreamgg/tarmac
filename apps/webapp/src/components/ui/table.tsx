import * as React from 'react';

import { cn } from '@/lib/cn';
import { HTMLMotionProps, motion } from 'motion/react';
import { fadeAnimations, rowCollapseAnimations } from '@/modules/ui/animation/presets';
import {
  ROW_SURFACE_TRANSITION_CLASSES,
  useRowCollapseTransition
} from '@/modules/ui/animation/useRowCollapse';

// Design-system table (Figma Patterns/Tables 5178:37455). The construction is
// unusual: rows are separated by a 2px transparent gap (border-spacing, page
// background showing through) instead of borders, cells carry the row surface
// (bg-bgSecondary) so a row reads as one bar, and the *body* — not the table —
// is a 24px-radius surface, so the outer corners live on the first/last data
// row's edge cells. The header row is transparent and sits outside that
// surface. All columns are left-aligned per Figma, including numeric ones.
//
// `animateRows` (Figma 1598:77060) swaps that construction so filtered rows
// can collapse to a true 0px height:
//  - a td's CSS height is a *minimum* — its content holds the row open — so
//    the surface moves off the td into a clipping cell wrapper the collapse
//    can drive;
//  - border-spacing is table-wide (a 0-height row still owns a 2px slot, which
//    would pop at unmount), so the 2px gap becomes part of the clipped content
//    (a margin on the surface inside the overflow-hidden wrapper) and
//    collapses with the row;
//  - the structural corner selectors would keep matching a row AnimatePresence
//    is exiting, leaving the surviving edge row square for the whole exit, so
//    the caller declares the edge rows instead — `data-first` / `data-last` on
//    TableRow, computed from its data (where exiting rows are already gone).
//    The selectors that style those edges live on TableRow below, so the
//    cell's internal markup stays private to this file.

const TableAnimationContext = React.createContext(false);

const Table = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement> & {
    className?: string;
    wrapperClassName?: string;
    /** Opt into the collapsible-row construction (see the header comment). */
    animateRows?: boolean;
  }
>(({ className, wrapperClassName, animateRows = false, ...props }, ref) => (
  <TableAnimationContext.Provider value={animateRows}>
    <div className={cn('relative w-full overflow-x-auto', wrapperClassName)}>
      <table
        ref={ref}
        className={cn(
          'w-full caption-bottom border-separate',
          animateRows
            ? 'border-spacing-y-0'
            : 'border-spacing-y-[2px] [&>tbody>tr:first-child>td:first-child]:rounded-tl-[24px] [&>tbody>tr:first-child>td:last-child]:rounded-tr-[24px] [&>tbody>tr:last-child>td:first-child]:rounded-bl-[24px] [&>tbody>tr:last-child>td:last-child]:rounded-br-[24px]',
          className
        )}
        {...props}
      />
    </div>
  </TableAnimationContext.Provider>
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
  ({ className, ...props }, ref) => {
    const animateRows = React.useContext(TableAnimationContext);
    return (
      <motion.tr
        ref={ref}
        initial={false}
        // The hover/selected tint must land on the row surface, not the tr:
        // with border-separate a tr background would also paint under the 2px
        // slits and the corner radii wouldn't clip it. In animateRows mode the
        // surface is the div inside the cell wrapper, not the td.
        className={cn(
          'group/row',
          animateRows
            ? cn(
                'has-[td]:hover:[&>td>div>div]:bg-bgTertiary data-[state=selected]:[&>td>div>div]:bg-bgTertiary',
                // Edge rows are caller-declared (data-first/data-last): the
                // radii, and — on the last row — the 2px the border-spacing
                // construction leaves below the body. Both sit inside the cell
                // clip, so they collapse and hand off with the row (the
                // surface's transition glides them onto the survivor).
                'data-[first=true]:[&>td:first-child>div>div]:rounded-tl-[24px] data-[first=true]:[&>td:last-child>div>div]:rounded-tr-[24px]',
                'data-[last=true]:[&>td:first-child>div>div]:rounded-bl-[24px] data-[last=true]:[&>td:last-child>div>div]:rounded-br-[24px] data-[last=true]:[&>td>div>div]:mb-0.5',
                // Non-interactive tables (data-hover="off") re-pin the hover
                // tint to the resting surface.
                'data-[hover=off]:has-[td]:hover:[&>td>div>div]:bg-bgSecondary'
              )
            : 'has-[td]:hover:[&>td]:bg-bgTertiary data-[state=selected]:[&>td]:bg-bgTertiary',
          className
        )}
        variants={fadeAnimations}
        {...props}
      />
    );
  }
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
>(({ className, children, ...props }, ref) => {
  const animateRows = React.useContext(TableAnimationContext);
  const collapseTransition = useRowCollapseTransition();

  if (!animateRows) {
    return (
      <td
        ref={ref}
        // Label 5 / fg-primary is the default cell value type; typed cells
        // (table-cells.tsx) override locally. 24px first-column inset.
        className={cn(
          'bg-bgSecondary text-fgPrimary font-circle h-[88px] px-2 align-middle text-sm leading-4 font-medium tracking-[-0.28px] transition-colors first:pl-6 [&:has([role=checkbox])]:pr-0',
          className
        )}
        {...props}
      >
        {children}
      </td>
    );
  }

  // Collapsible construction: the td is a transparent zero-padding container
  // (text styles stay here so callers' `[&>td]:text-*` overrides keep
  // working), the motion wrapper clips the collapse, and the inner div is the
  // row surface — min-h, not h, so tall content still grows the row like the
  // plain construction's td minimum did (the wrapper animates from 'auto', so
  // a taller row just collapses from its natural height). The surface's 2px
  // top margin is the inter-row gap — inside the clip, so it collapses with
  // the row (the wrapper is a formatting context, so the margin can't
  // escape). ROW_SURFACE_TRANSITION_CLASSES carries the hover/handoff
  // transitions (see useRowCollapse.ts).
  return (
    <td
      ref={ref}
      className={cn(
        'text-fgPrimary font-circle p-0 align-top text-sm leading-4 font-medium tracking-[-0.28px] transition-colors [&:first-child>div>div]:pl-6 [&:has([role=checkbox])>div>div]:pr-0',
        className
      )}
      {...props}
    >
      <motion.div
        className="overflow-hidden"
        variants={rowCollapseAnimations}
        transition={collapseTransition}
      >
        <div
          className={cn(
            'bg-bgSecondary mt-0.5 flex min-h-[88px] items-center px-2',
            ROW_SURFACE_TRANSITION_CLASSES
          )}
        >
          {children}
        </div>
      </motion.div>
    </td>
  );
});
TableCell.displayName = 'TableCell';

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement> & { className?: string }
>(({ className, ...props }, ref) => (
  <caption ref={ref} className={cn('text-muted-foreground mt-4 text-sm', className)} {...props} />
));
TableCaption.displayName = 'TableCaption';

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption };
