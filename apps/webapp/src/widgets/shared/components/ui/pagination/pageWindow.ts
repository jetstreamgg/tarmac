/**
 * Pagination button window derived from (currentPage, totalPages) on every
 * render — never stored — because totalPages is live: keyset-paginated sources
 * append rows (totalPages grows mid-interaction) and filtered sources shrink
 * it. The shape is the DS comp's (5984:10389, "1 2 3 … 8 9 10"): three pages
 * at each end while the current page sits in one of them, and the current
 * page with its neighbors between two ellipses mid-list ([1] … [4] [5] [6] … [20]).
 */
export function pageWindow(currentPage: number, totalPages: number): (number | 'ellipsis')[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }
  if (currentPage <= 3 || currentPage >= totalPages - 2) {
    return [1, 2, 3, 'ellipsis', totalPages - 2, totalPages - 1, totalPages];
  }
  return [1, 'ellipsis', currentPage - 1, currentPage, currentPage + 1, 'ellipsis', totalPages];
}
