import { useState } from 'react';
import { pageWindow } from '@/widgets/shared/components/ui/pagination/pageWindow';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLabel,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis
} from '@/components/ui/pagination';

type CustomPaginationProps = {
  dataLength: number;
  onPageChange: (page: number) => void;
  itemsPerPage?: number;
  className?: string;
};

/**
 * Stateful pager over a live row count. Renders the DS Pagination in both
 * shapes: the numbered window from `md` up and the "Page x of y" pill below,
 * where the tables it follows fold into cards.
 */
export const CustomPagination = ({
  dataLength,
  onPageChange,
  itemsPerPage = 5,
  className
}: CustomPaginationProps) => {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(dataLength / itemsPerPage));
  // Data can shrink between renders; keep the effective page in range.
  const currentPage = Math.min(page, totalPages);

  const goTo = (next: number) => {
    const clamped = Math.min(Math.max(next, 1), totalPages);
    setPage(clamped);
    onPageChange(clamped);
  };

  if (totalPages <= 1) return null;

  return (
    <Pagination className={className}>
      <PaginationPrevious onClick={() => goTo(currentPage - 1)} disabled={currentPage === 1} />
      <PaginationContent className="hidden md:flex">
        {pageWindow(currentPage, totalPages).map((entry, index) =>
          entry === 'ellipsis' ? (
            <PaginationItem key={`ellipsis-${index}`}>
              <PaginationEllipsis />
            </PaginationItem>
          ) : (
            <PaginationItem key={entry}>
              <PaginationLink isActive={entry === currentPage} onClick={() => goTo(entry)}>
                {entry}
              </PaginationLink>
            </PaginationItem>
          )
        )}
      </PaginationContent>
      <PaginationLabel current={currentPage} total={totalPages} className="md:hidden" />
      <PaginationNext onClick={() => goTo(currentPage + 1)} disabled={currentPage === totalPages} />
    </Pagination>
  );
};
