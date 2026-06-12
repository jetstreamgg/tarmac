import * as React from 'react';
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';

import { cn } from '@/lib/cn';
import {
  ButtonProps,
  buttonVariants,
  ButtonWidgetProps,
  buttonWidgetVariants
} from '@/components/ui/button';

// App look — canonical, unchanged.

const Pagination = ({ className, ...props }: React.ComponentProps<'nav'> & { className?: string }) => (
  <nav
    role="navigation"
    aria-label="pagination"
    className={cn('mx-auto mt-4 flex h-8 w-full justify-end', className)}
    {...props}
  />
);
Pagination.displayName = 'Pagination';

const PaginationContent = React.forwardRef<
  HTMLUListElement,
  React.ComponentProps<'ul'> & { className?: string }
>(({ className, ...props }, ref) => (
  <ul ref={ref} className={cn('flex flex-row items-center gap-2', className)} {...props} />
));
PaginationContent.displayName = 'PaginationContent';

const PaginationItem = React.forwardRef<HTMLLIElement, React.ComponentProps<'li'> & { className?: string }>(
  ({ className, ...props }, ref) => (
    <li ref={ref} className={cn('mx-1 list-none rounded-full', className)} {...props} />
  )
);
PaginationItem.displayName = 'PaginationItem';

type PaginationLinkProps = {
  isActive?: boolean;
  disabled?: boolean;
  className?: string;
} & Pick<ButtonProps, 'size'> &
  React.ComponentProps<'button'>;

const PaginationLink = ({ className, isActive, disabled, size = 'icon', ...props }: PaginationLinkProps) => (
  <button
    disabled={disabled}
    aria-current={isActive ? 'page' : undefined}
    className={cn(
      buttonVariants({
        variant: isActive ? 'paginationActive' : 'pagination',
        size
      }),
      'h-8 w-8',
      className
    )}
    {...props}
  />
);
PaginationLink.displayName = 'PaginationLink';

const PaginationPrevious = ({
  className,
  longFormat,
  ...props
}: React.ComponentProps<typeof PaginationLink> & { longFormat?: boolean; className?: string }) => (
  <PaginationLink
    aria-label="Go to previous page"
    size="default"
    className={cn(`gap-1 ${longFormat ? 'pl-2.5' : 'px-2'} text-text`, className)}
    {...props}
  >
    <ChevronLeft className="h-6 w-6" />
    {longFormat && <span>Previous</span>}
  </PaginationLink>
);
PaginationPrevious.displayName = 'PaginationPrevious';

const PaginationNext = ({
  className,
  longFormat,
  ...props
}: React.ComponentProps<typeof PaginationLink> & { longFormat?: boolean; className?: string }) => (
  <PaginationLink
    aria-label="Go to next page"
    size="default"
    className={cn(`gap-1 ${longFormat ? 'pl-2.5' : 'px-2'} text-text`, className)}
    {...props}
  >
    {longFormat && <span>Next</span>}
    <ChevronRight className="h-6 w-6" />
  </PaginationLink>
);
PaginationNext.displayName = 'PaginationNext';

const PaginationEllipsis = ({
  className,
  ...props
}: React.ComponentProps<'span'> & { className?: string }) => (
  <span
    aria-hidden
    className={cn(
      'text-selectActive light:text-textSecondary flex h-9 w-9 items-center justify-center text-base leading-normal',
      className
    )}
    {...props}
  >
    <MoreHorizontal className="h-4 w-4" />
    <span className="sr-only h-0">More pages</span>
  </span>
);
PaginationEllipsis.displayName = 'PaginationEllipsis';

// Widget look — relocated under PaginationWidget*; the widgets/pagination shim aliases it back.

const PaginationWidget = ({ className, ...props }: React.ComponentProps<'nav'>) => (
  <nav
    role="navigation"
    aria-label="pagination"
    className={cn('mx-auto flex h-8 w-full justify-center', className)}
    {...props}
  />
);
PaginationWidget.displayName = 'Pagination';

const PaginationWidgetItem = React.forwardRef<HTMLLIElement, React.ComponentProps<'li'>>(
  ({ className, ...props }, ref) => (
    <li ref={ref} className={cn('mx-1 list-none rounded-full', className)} {...props} />
  )
);
PaginationWidgetItem.displayName = 'PaginationItem';

type PaginationWidgetLinkProps = {
  isActive?: boolean;
  disabled?: boolean;
} & Pick<ButtonWidgetProps, 'size'> &
  React.ComponentProps<'button'>;

const PaginationWidgetLink = ({
  className,
  isActive,
  disabled,
  size = 'icon',
  ...props
}: PaginationWidgetLinkProps) => (
  <button
    disabled={disabled}
    aria-current={isActive ? 'page' : undefined}
    className={cn(
      buttonWidgetVariants({
        variant: isActive ? 'paginationActive' : 'pagination',
        size
      }),
      'h-8 w-8',
      className
    )}
    {...props}
  />
);
PaginationWidgetLink.displayName = 'PaginationLink';

const PaginationWidgetPrevious = ({
  className,
  longFormat,
  ...props
}: React.ComponentProps<typeof PaginationWidgetLink> & { longFormat?: boolean }) => (
  <PaginationWidgetLink
    aria-label="Go to previous page"
    size="default"
    className={cn(`gap-1 ${longFormat ? 'pl-2.5' : 'px-2'} text-text`, className)}
    {...props}
  >
    <ChevronLeft className="h-6 w-6" />
    {longFormat && <span>Previous</span>}
  </PaginationWidgetLink>
);
PaginationWidgetPrevious.displayName = 'PaginationPrevious';

const PaginationWidgetNext = ({
  className,
  longFormat,
  ...props
}: React.ComponentProps<typeof PaginationWidgetLink> & { longFormat?: boolean }) => (
  <PaginationWidgetLink
    aria-label="Go to next page"
    size="default"
    className={cn(`gap-1 ${longFormat ? 'pl-2.5' : 'px-2'} text-text`, className)}
    {...props}
  >
    {longFormat && <span>Next</span>}
    <ChevronRight className="h-6 w-6" />
  </PaginationWidgetLink>
);
PaginationWidgetNext.displayName = 'PaginationNext';

const PaginationWidgetEllipsis = ({ className, ...props }: React.ComponentProps<'span'>) => (
  <span
    aria-hidden
    className={cn(
      'text-selectActive light:text-textSecondary flex h-9 w-9 items-center justify-center text-base leading-normal',
      className
    )}
    {...props}
  >
    <MoreHorizontal className="h-4 w-4" />
    <span className="sr-only h-0">More pages</span>
  </span>
);
PaginationWidgetEllipsis.displayName = 'PaginationEllipsis';

export {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious
};
export {
  PaginationWidget,
  PaginationWidgetEllipsis,
  PaginationWidgetItem,
  PaginationWidgetLink,
  PaginationWidgetNext,
  PaginationWidgetPrevious
};
