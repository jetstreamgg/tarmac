export interface PaginatedRows<T> {
  /** The rows visible on the requested page. */
  rows: T[];
  /** Total number of pages for the full row set (always >= 1). */
  totalPages: number;
}

/** Client-side slice of an already-fetched row set into one page (C4). */
export function paginate<T>(rows: T[], pageSize: number, page: number): PaginatedRows<T> {
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  // Clamp so a stale/out-of-range page still yields a real slice, never empty.
  const current = Math.min(Math.max(page, 1), totalPages);
  const start = (current - 1) * pageSize;
  return { rows: rows.slice(start, start + pageSize), totalPages };
}
