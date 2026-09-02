import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Trans } from '@lingui/react/macro';

import { cn } from '@/lib/cn';

/**
 * Design-system Pagination (DS 5984:10221; app placement 2829:140116).
 *
 * Three parts, each a DS component:
 * - `_Pagination number base` (5984:10353): a 32px circle in Label 5. Default
 *   is bare; hover fills with gradient-brand2; the active page keeps that fill
 *   and adds the border-secondary hairline; focus draws the 2px border-focus
 *   ring flush against the edge. The ellipsis is the same base at 24px, radius
 *   8, in fg-quaternary.
 * - `_pagination arrow` (5984:10367): a 32px bordered circle around a 24px
 *   chevron. The DS draws its hover identical to default; focus is the 2px
 *   fg-brand-primary ring one pixel off the edge.
 * - The component itself: arrows 24px from the number group on web (gap 2px
 *   between numbers), and on mobile a "Page 1 of 10" Label 6 pill between the
 *   arrows instead of the list, 16px apart. `PaginationContent` hides below
 *   `md` (where the transaction tables fold into cards) and `PaginationLabel`
 *   shows there, so a caller renders both and the breakpoint picks.
 *
 * The strokes are Figma inside-strokes on a 32px frame, so a CSS `border` on
 * a `size-8` box lands on the same pixels; the focus rings are outside strokes
 * and go on `outline`, which needs no offset color over the glass surfaces.
 */

const Pagination = ({ className, ...props }: React.ComponentProps<'nav'> & { className?: string }) => (
  <nav
    role="navigation"
    aria-label="pagination"
    className={cn('mx-auto mt-4 flex w-full items-center justify-center gap-4 md:gap-6', className)}
    {...props}
  />
);
Pagination.displayName = 'Pagination';

const PaginationContent = React.forwardRef<
  HTMLUListElement,
  React.ComponentProps<'ul'> & { className?: string }
>(({ className, ...props }, ref) => (
  <ul ref={ref} className={cn('flex flex-row items-center gap-0.5', className)} {...props} />
));
PaginationContent.displayName = 'PaginationContent';

const PaginationItem = React.forwardRef<HTMLLIElement, React.ComponentProps<'li'> & { className?: string }>(
  ({ className, ...props }, ref) => <li ref={ref} className={cn('list-none', className)} {...props} />
);
PaginationItem.displayName = 'PaginationItem';

const controlBase =
  'font-circle text-text inline-flex size-8 shrink-0 items-center justify-center rounded-full text-sm leading-4 font-medium tracking-[-0.28px] bg-origin-border transition-[background-color,--tw-gradient-from,--tw-gradient-to,border-color,color] duration-250 ease-out-expo focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-focusRing disabled:pointer-events-none disabled:text-fgTertiary';

type PaginationLinkProps = {
  isActive?: boolean;
  disabled?: boolean;
  className?: string;
} & React.ComponentProps<'button'>;

/** `_Pagination number base`: one page number. */
const PaginationLink = ({ className, isActive, disabled, ...props }: PaginationLinkProps) => (
  <button
    type="button"
    disabled={disabled}
    aria-current={isActive ? 'page' : undefined}
    className={cn(
      controlBase,
      'px-2',
      isActive
        ? 'border-glassBorder from-brand2-start to-brand2-end border bg-linear-to-b'
        : 'hover:from-brand2-start hover:to-brand2-end hover:bg-linear-to-b',
      className
    )}
    {...props}
  />
);
PaginationLink.displayName = 'PaginationLink';

/** `_pagination arrow`: the bordered chevron circle. */
const arrowClasses =
  'border-glassBorder hover:bg-glassBadge border focus-visible:outline-offset-1 focus-visible:outline-fgBrand disabled:border-glassBadge';

const PaginationPrevious = ({ className, ...props }: PaginationLinkProps) => (
  <button
    type="button"
    aria-label="Go to previous page"
    className={cn(controlBase, arrowClasses, className)}
    {...props}
  >
    <ChevronLeft className="size-6" aria-hidden />
  </button>
);
PaginationPrevious.displayName = 'PaginationPrevious';

const PaginationNext = ({ className, ...props }: PaginationLinkProps) => (
  <button
    type="button"
    aria-label="Go to next page"
    className={cn(controlBase, arrowClasses, className)}
    {...props}
  >
    <ChevronRight className="size-6" aria-hidden />
  </button>
);
PaginationNext.displayName = 'PaginationNext';

const PaginationEllipsis = ({
  className,
  ...props
}: React.ComponentProps<'span'> & { className?: string }) => (
  <span
    aria-hidden
    className={cn(
      'text-fgQuaternary font-circle flex size-6 items-center justify-center rounded-lg text-sm leading-4 font-medium tracking-[-0.28px]',
      className
    )}
    {...props}
  >
    ...
    <span className="sr-only h-0">More pages</span>
  </span>
);
PaginationEllipsis.displayName = 'PaginationEllipsis';

/** The mobile "Page 1 of 10" pill that stands in for the number list. */
const PaginationLabel = ({
  current,
  total,
  className,
  ...props
}: React.ComponentProps<'span'> & { current: number; total: number; className?: string }) => (
  <span
    aria-live="polite"
    className={cn(
      'font-circle text-text flex h-6 items-center rounded-lg px-3 text-xs leading-[14px] font-medium tracking-[-0.24px]',
      className
    )}
    {...props}
  >
    <Trans>
      Page {current} of {total}
    </Trans>
  </span>
);
PaginationLabel.displayName = 'PaginationLabel';

export {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLabel,
  PaginationLink,
  PaginationNext,
  PaginationPrevious
};

// The widget look used to be a second set of primitives (PaginationWidget*);
// the DS has one Pagination, so those names now alias the app parts. The
// widgets/pagination shim re-exports them under the plain names.
export {
  Pagination as PaginationWidget,
  PaginationEllipsis as PaginationWidgetEllipsis,
  PaginationItem as PaginationWidgetItem,
  PaginationLink as PaginationWidgetLink,
  PaginationNext as PaginationWidgetNext,
  PaginationPrevious as PaginationWidgetPrevious
};
