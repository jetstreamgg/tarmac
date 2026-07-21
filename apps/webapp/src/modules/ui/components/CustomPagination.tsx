import { useState } from 'react';
import {
  Pagination,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis
} from '../../../components/ui/pagination';

type CustomPaginationProps = {
  dataLength: number;
  onPageChange: (page: number) => void;
  itemsPerPage?: number;
};

/**
 * The button window is derived from (currentPage, totalPages) on every render —
 * never stored — because totalPages is live: keyset-paginated sources append
 * rows (totalPages grows mid-interaction) and filtered sources shrink it.
 */
function pageWindow(currentPage: number, totalPages: number): (number | 'ellipsis')[] {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }
  if (currentPage <= 3) {
    return [1, 2, 3, 'ellipsis', totalPages];
  }
  if (currentPage >= totalPages - 2) {
    return [1, 'ellipsis', totalPages - 2, totalPages - 1, totalPages];
  }
  return [1, 'ellipsis', currentPage, 'ellipsis', totalPages];
}

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
    <Pagination>
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
