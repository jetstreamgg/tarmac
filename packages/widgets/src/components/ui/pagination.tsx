import * as React from 'react';
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';

import { cn } from '@/lib/utils';
import { ButtonProps, buttonVariants } from '@/components/ui/button';

const Pagination = ({ className, ...props }: React.ComponentProps<'nav'>) => (
  <nav
    role="navigation"
    aria-label="pagination"
    className={cn('mx-auto flex h-8 w-full justify-center', className)}
    {...props}
  />
);
Pagination.displayName = 'Pagination';

const PaginationItem = React.forwardRef<HTMLLIElement, React.ComponentProps<'li'>>(
  ({ className, ...props }, ref) => (
    <li ref={ref} className={cn('mx-1 list-none rounded-full', className)} {...props} />
  )
);
PaginationItem.displayName = 'PaginationItem';

type PaginationLinkProps = {
  isActive?: boolean;
  disabled?: boolean;
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
}: React.ComponentProps<typeof PaginationLink> & { longFormat?: boolean }) => (
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
}: React.ComponentProps<typeof PaginationLink> & { longFormat?: boolean }) => (
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

const PaginationEllipsis = ({ className, ...props }: React.ComponentProps<'span'>) => (
  <span
    aria-hidden
    className={cn(
      'text-selectActive flex h-9 w-9 items-center justify-center text-base leading-normal',
      className
    )}
    {...props}
  >
    <MoreHorizontal className="h-4 w-4" />
    <span className="sr-only h-0">More pages</span>
  </span>
);
PaginationEllipsis.displayName = 'PaginationEllipsis';

export { Pagination, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious };
