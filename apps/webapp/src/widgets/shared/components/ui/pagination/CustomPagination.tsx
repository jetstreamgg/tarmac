import { useState } from 'react';
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
  const maxPageButtons = 5;
  const [currentPage, setCurrentPage] = useState(1);
  const [ellipsisAtEnd, setEllipsisAtEnd] = useState(true);
  const [middlePage, setMiddlePage] = useState(3); //assumes max 5 page buttons
  const [offset, setOffset] = useState(0);
  const totalPages = Math.ceil(dataLength / itemsPerPage);

  // Handle page change
  const handlePageClick = (page: number) => {
    onPageChange(page);
    setCurrentPage(page);
    if (page === 1) {
      setOffset(0);
      setEllipsisAtEnd(true);
      setMiddlePage(1 + 2);
      return;
    }
    if (!ellipsisAtEnd && middlePage === 1 + 2 && page <= middlePage) {
      setOffset(0);
      setEllipsisAtEnd(true);
      return;
    }
    if (page === totalPages) {
      setOffset(0);
      setEllipsisAtEnd(false);
      setMiddlePage(totalPages - 2);
      return;
    }
    if (ellipsisAtEnd && middlePage === totalPages - 2 && page >= middlePage) {
      setOffset(0);
      setEllipsisAtEnd(false);
      setMiddlePage(totalPages - 2);
      return;
    }
    if (page > middlePage && ellipsisAtEnd) {
      setOffset(offset + 1);
      setMiddlePage(middlePage + 1);
      return;
    }
    if (page < middlePage && !ellipsisAtEnd) {
      setOffset(offset + 1);
      setMiddlePage(middlePage - 1);
      return;
    }
    if (page > middlePage + 2) {
      setOffset(offset - 1);
      setMiddlePage(middlePage + 1);
    }
    if (page < middlePage - 2) {
      setOffset(offset - 1);
      setMiddlePage(middlePage - 1);
    }
  };

  const pageButtonsSimple = Array.from({ length: totalPages }, (_, index) => (
    <PaginationItem key={index}>
      <PaginationLink isActive={index + 1 === currentPage} onClick={() => handlePageClick(index + 1)}>
        {index + 1}
      </PaginationLink>
    </PaginationItem>
  ));

  const pageButtonsWithEllipsisAtEnd = [
    <PaginationItem key={0}>
      <PaginationLink isActive={1 + offset === currentPage} onClick={() => handlePageClick(1 + offset)}>
        {1 + offset}
      </PaginationLink>
    </PaginationItem>,
    <PaginationItem key={1}>
      <PaginationLink isActive={2 + offset === currentPage} onClick={() => handlePageClick(2 + offset)}>
        {2 + offset}
      </PaginationLink>
    </PaginationItem>,
    <PaginationItem key={2}>
      <PaginationLink isActive={3 + offset === currentPage} onClick={() => handlePageClick(3 + offset)}>
        {3 + offset}
      </PaginationLink>
    </PaginationItem>,
    <PaginationItem key={3}>
      <PaginationEllipsis />
    </PaginationItem>,
    <PaginationItem key={4}>
      <PaginationLink isActive={totalPages === currentPage} onClick={() => handlePageClick(totalPages)}>
        {totalPages}
      </PaginationLink>
    </PaginationItem>
  ];

  const pageButtonsWithEllipsisAtBeginning = [
    <PaginationItem key={0}>
      <PaginationLink isActive={1 === currentPage} onClick={() => handlePageClick(1)}>
        1
      </PaginationLink>
    </PaginationItem>,
    <PaginationItem key={1}>
      <PaginationEllipsis />
    </PaginationItem>,
    <PaginationItem key={2}>
      <PaginationLink
        isActive={totalPages - 2 - offset === currentPage}
        onClick={() => handlePageClick(totalPages - 2 - offset)}
      >
        {totalPages - 2 - offset}
      </PaginationLink>
    </PaginationItem>,
    <PaginationItem key={3}>
      <PaginationLink
        isActive={totalPages - 1 - offset === currentPage}
        onClick={() => handlePageClick(totalPages - 1 - offset)}
      >
        {totalPages - 1 - offset}
      </PaginationLink>
    </PaginationItem>,
    <PaginationItem key={4}>
      <PaginationLink
        isActive={totalPages - offset === currentPage}
        onClick={() => handlePageClick(totalPages - offset)}
      >
        {totalPages - offset}
      </PaginationLink>
    </PaginationItem>
  ];

  return (
    <>
      {totalPages > 1 && (
        <Pagination className="mt-3">
          <PaginationPrevious onClick={() => handlePageClick(currentPage - 1)} disabled={currentPage === 1} />
          {totalPages <= maxPageButtons
            ? pageButtonsSimple
            : ellipsisAtEnd
              ? pageButtonsWithEllipsisAtEnd
              : pageButtonsWithEllipsisAtBeginning}
          <PaginationNext
            onClick={() => handlePageClick(currentPage + 1)}
            disabled={currentPage === totalPages}
          />
        </Pagination>
      )}
    </>
  );
};
