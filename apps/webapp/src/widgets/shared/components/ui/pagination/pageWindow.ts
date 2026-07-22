/**
 * Pagination button window derived from (currentPage, totalPages) on every
 * render — never stored — because totalPages is live: keyset-paginated sources
 * append rows (totalPages grows mid-interaction) and filtered sources shrink
 * it. Mid-list the window keeps the current page's neighbors visible
 * ([1] … [4] [5] [6] … [20]), preserving the run of adjacent pages the
 * previous stateful implementation showed.
 */
export function pageWindow(currentPage: number, totalPages: number): (number | 'ellipsis')[] {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }
  if (currentPage <= 3) {
    return [1, 2, 3, 'ellipsis', totalPages];
  }
  if (currentPage >= totalPages - 2) {
    return [1, 'ellipsis', totalPages - 2, totalPages - 1, totalPages];
  }
  return [1, 'ellipsis', currentPage - 1, currentPage, currentPage + 1, 'ellipsis', totalPages];
}
