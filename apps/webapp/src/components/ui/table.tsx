import * as React from 'react';

import { cn } from '@/lib/utils';
import { HTMLMotionProps, motion } from 'framer-motion';
import { fadeAnimations } from '@/modules/ui/animation/presets';

const Table = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement> & { className?: string }
>(({ className, ...props }, ref) => (
  <div className="relative w-full overflow-hidden">
    <table ref={ref} className={cn('w-full caption-bottom text-sm', className)} {...props} />
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
      className={cn(
        'border-brandLight/20 has-[td]:hover:bg-brandLight/20 has-[td]:focus:border-brandLight/40 has-[td]:active:bg-brandLight/10 data-[state=selected]:bg-brandLight/10 border-t transition-colors last:border-b has-[th]:border-0 has-[td]:focus:border-y-2',
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
    className={cn(
      'text-selectActive h-4 px-4 py-2 text-left align-middle text-[13px] font-normal leading-none [&:has([role=checkbox])]:pr-0',
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
    className={cn(
      'text-text h-14 p-4 align-middle text-base font-normal leading-normal [&:has([role=checkbox])]:pr-0',
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
