import { useState } from 'react';
import { pageWindow } from './pageWindow';
import {
  Pagination,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis
} from '../../../../components/ui/pagination';

type CustomPaginationProps = {
  dataLength: number;
  onPageChange: (page: number) => void;
  itemsPerPage?: number;
};

export const CustomPagination = ({ dataLength, onPageChange, itemsPerPage = 5 }: CustomPaginationProps) => {
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
    <Pagination className="mt-3">
      <PaginationPrevious onClick={() => goTo(currentPage - 1)} disabled={currentPage === 1} />
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
      <PaginationNext onClick={() => goTo(currentPage + 1)} disabled={currentPage === totalPages} />
    </Pagination>
  );
};
