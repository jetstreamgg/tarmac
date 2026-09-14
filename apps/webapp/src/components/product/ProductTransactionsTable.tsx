import { hasTextSelection, openInNewTab } from '@/lib/openInNewTab';
import { Fragment, ReactNode, useState } from 'react';
import { Trans } from '@lingui/react/macro';
import { cn } from '@/lib/cn';
import { BP, useBreakpointIndex } from '@/hooks';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { TransactionsEmpty } from '@/modules/icons';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CustomPagination } from '@/modules/ui/components/CustomPagination';
import { TransactionCardSkeleton } from './TransactionCard';
import { paginate } from './paginate';

/**
 * Reusable transactions table for product-detail pages (Figma Table/
 * Transactions 5178:37513 and its Min/Stake flavours). Column-driven so each
 * module defines its own columns — Savings/Vaults/Rewards/Stake history
 * differ — while the shared chrome (ui/table surface, loading/empty/error
 * states, pagination) lives here. Cell contents come from the design-system
 * typed cells (ui/table-cells) via the column `cell` renderers.
 *
 * M5: below the md tier (768, the ResponsiveModal switch) a consumer-supplied
 * `renderCard` swaps the <table> for a stacked card list (Figma mobile Table
 * Sections, e.g. 486:20827) — same rows, loading/empty/error and pagination.
 */

export type ProductTransactionStatus = 'pending' | 'completed';

/** Placeholder rows/cards rendered while `isLoading`. */
const LOADING_ROWS = 4;

export interface ProductTransactionColumn<T> {
  id: string;
  header: ReactNode;
  /** Width hint: `fr` weights are converted to percentages, px pass through. */
  width: string;
  cell: (row: T) => ReactNode;
  /** Set false for icon/affordance columns (chevrons, network icons) so loading doesn't paint a text bar there. */
  skeleton?: boolean;
}

export interface ProductTransactionsTableProps<T> {
  columns: ProductTransactionColumn<T>[];
  rows?: T[];
  rowKey: (row: T) => string;
  isLoading?: boolean;
  error?: Error | null;
  emptyLabel?: ReactNode;
  /** DS empty illustration above `emptyLabel`; defaults to the transactions pair. */
  emptyIllustration?: ReactNode;
  dataTestId?: string;
  /** Rows per page; the control appears once the set exceeds it (C4). */
  pageSize?: number;
  /** Called after the page changes — e.g. to fetch more rows when the user lands on the last page. */
  onPageChange?: (page: number, totalPages: number) => void;
  /** Makes rows interactive (button semantics + pointer cursor). */
  onRowClick?: (row: T) => void;
  /**
   * Explorer link for a row: the whole row opens it in a new tab, like the
   * hash cell does (Figma 2800:92277). Rows it returns nothing for stay inert
   * — no pointer, no hover tint. Ignored on a row `onRowClick` handles.
   */
  rowHref?: (row: T) => string | undefined;
  /** Per-row test id, e.g. for row-click specs. */
  rowTestId?: (row: T) => string;
  /** Full-width content rendered as a sibling right after a matching row, outside its click/hover surface. */
  renderBelowRow?: (row: T) => ReactNode;
  /** Mobile card for a row; providing it swaps the table for a card list below the md tier. */
  renderCard?: (row: T) => ReactNode;
  /** Loading stand-in matching the consumer's card shape; defaults to a 1-field-row TransactionCardSkeleton. */
  cardSkeleton?: ReactNode;
}

// The legacy grid API declared tracks ('1.5fr', '140px'); a <table> wants
// width hints instead, so fr weights become percentages of the fr total.
function columnWidths<T>(columns: ProductTransactionColumn<T>[]): string[] {
  const frTotal = columns.reduce(
    (total, column) => total + (column.width.endsWith('fr') ? parseFloat(column.width) : 0),
    0
  );
  return columns.map(column =>
    column.width.endsWith('fr') ? `${(parseFloat(column.width) / frTotal) * 100}%` : column.width
  );
}

function StateRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <TableRow className="pointer-events-none">
      <TableCell colSpan={colSpan} className="text-fgSecondary font-graphik text-center tracking-normal">
        {children}
      </TableCell>
    </TableRow>
  );
}

/** Card-mode stand-in for StateRow: the message on a single card surface. */
function StateCard({ children }: { children: ReactNode }) {
  return (
    <div className="bg-bgSecondary text-fgSecondary font-graphik rounded-[20px] p-5 text-center text-sm">
      {children}
    </div>
  );
}

export function ProductTransactionsTable<T>({
  columns,
  rows,
  rowKey,
  isLoading,
  error,
  emptyLabel,
  emptyIllustration = <TransactionsEmpty aria-hidden />,
  dataTestId = 'product-transactions',
  pageSize = 7,
  onPageChange,
  onRowClick,
  rowHref,
  rowTestId,
  renderBelowRow,
  renderCard,
  cardSkeleton = <TransactionCardSkeleton />
}: ProductTransactionsTableProps<T>) {
  // One activation per row: the consumer's handler wins, else the explorer
  // link; undefined leaves the row inert.
  const rowAction = (row: T): (() => void) | undefined => {
    if (onRowClick) return () => onRowClick(row);
    const href = rowHref?.(row);
    return href ? () => openInNewTab(href) : undefined;
  };
  // A click that ends a text-selection drag is the selection, not a request
  // to open the row; keyboard activation never carries one.
  const clickAction = (activate: (() => void) | undefined) =>
    activate
      ? () => {
          if (hasTextSelection()) return;
          activate();
        }
      : undefined;
  const allRows = rows ?? [];
  const [page, setPage] = useState(1);
  const { rows: pageRows, totalPages } = paginate(allRows, pageSize, page);
  const handlePageChange = (nextPage: number) => {
    setPage(nextPage);
    onPageChange?.(nextPage, totalPages);
  };
  const showPagination = !isLoading && !error && totalPages > 1;
  const widths = columnWidths(columns);
  const { bpi } = useBreakpointIndex();

  if (renderCard && bpi < BP.md) {
    return (
      <>
        {/* 2px gaps + outer-corners-only rounding mirror the desktop table
            surface (border-spacing-y + first/last cell radii). */}
        <div data-testid={dataTestId} className="flex w-full flex-col gap-0.5">
          {isLoading ? (
            Array.from({ length: LOADING_ROWS }).map((_, index) => (
              <div
                key={index}
                className={cn(
                  'overflow-hidden',
                  index === 0 && 'rounded-t-[20px]',
                  index === LOADING_ROWS - 1 && 'rounded-b-[20px]'
                )}
              >
                {cardSkeleton}
              </div>
            ))
          ) : error ? (
            <StateCard>
              <Trans>Unable to load transactions, please try again later.</Trans>
            </StateCard>
          ) : allRows.length === 0 ? (
            <StateCard>
              <EmptyState illustration={emptyIllustration}>
                {emptyLabel ?? <Trans>You don&apos;t have any transactions made yet.</Trans>}
              </EmptyState>
            </StateCard>
          ) : (
            pageRows.map((row, index) => {
              const activate = rowAction(row);
              return (
                <Fragment key={rowKey(row)}>
                  <div
                    data-testid={rowTestId?.(row)}
                    tabIndex={activate ? 0 : undefined}
                    onClick={clickAction(activate)}
                    onKeyDown={
                      activate
                        ? event => {
                            if (event.target !== event.currentTarget) return;
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              activate();
                            }
                          }
                        : undefined
                    }
                    className={cn(
                      'overflow-hidden',
                      index === 0 && 'rounded-t-[20px]',
                      index === pageRows.length - 1 && 'rounded-b-[20px]',
                      activate && 'cursor-pointer'
                    )}
                  >
                    {renderCard(row)}
                  </div>
                  {renderBelowRow?.(row)}
                </Fragment>
              );
            })
          )}
        </div>
        {showPagination && (
          <CustomPagination
            dataLength={allRows.length}
            itemsPerPage={pageSize}
            onPageChange={handlePageChange}
          />
        )}
      </>
    );
  }

  return (
    <>
      {/* No width floor: the cells' own min-content is the only limit before the
          wrapper scrolls. A fixed floor forced a scroll inside the tablet-seam
          pane (912 to 1200), where the design fits this table in 587px. */}
      <Table data-testid={dataTestId}>
        <TableHeader>
          <TableRow>
            {columns.map((column, index) => (
              <TableHead key={column.id} style={{ width: widths[index] }}>
                {column.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            Array.from({ length: LOADING_ROWS }).map((_, index) => (
              <TableRow key={index} className="pointer-events-none">
                {columns.map(column => (
                  <TableCell key={column.id}>
                    {column.skeleton !== false && <Skeleton className="h-5 w-2/3" />}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : error ? (
            <StateRow colSpan={columns.length}>
              <Trans>Unable to load transactions, please try again later.</Trans>
            </StateRow>
          ) : allRows.length === 0 ? (
            <StateRow colSpan={columns.length}>
              <EmptyState illustration={emptyIllustration}>
                {emptyLabel ?? <Trans>You don&apos;t have any transactions made yet.</Trans>}
              </EmptyState>
            </StateRow>
          ) : (
            pageRows.map((row, index) => {
              const belowRow = renderBelowRow?.(row);
              const activate = rowAction(row);
              return (
                <Fragment key={rowKey(row)}>
                  <TableRow
                    data-testid={rowTestId?.(row)}
                    data-hover={activate ? undefined : 'off'}
                    // No role="button": overriding the native row role breaks
                    // table navigation for assistive tech (CodeRabbit).
                    tabIndex={activate ? 0 : undefined}
                    onClick={clickAction(activate)}
                    onKeyDown={
                      activate
                        ? event => {
                            // Only activate on the row itself — Enter on a
                            // nested link/button must keep its native action.
                            if (event.target !== event.currentTarget) return;
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              activate();
                            }
                          }
                        : undefined
                    }
                    className={cn(
                      activate && 'cursor-pointer',
                      // A banner carrier row (below) becomes tbody's real last
                      // <tr> and takes the shared table selectors' bottom
                      // corners with it — visibly squaring the last data row
                      // (worst with a single position). Re-pin the radii to the
                      // last *data* row whenever carriers are in play.
                      renderBelowRow &&
                        index === pageRows.length - 1 &&
                        '[&>td:first-child]:rounded-bl-[24px] [&>td:last-child]:rounded-br-[24px]'
                    )}
                  >
                    {columns.map(column => (
                      <TableCell key={column.id}>{column.cell(row)}</TableCell>
                    ))}
                  </TableRow>
                  {belowRow && (
                    // Chrome-less carrier row: transparent (the ! outranks the
                    // row hover tint) and outside the clickable surface. If it
                    // lands last it takes the last-row corner slot — banners
                    // are rare and the radius loss is invisible on a
                    // transparent cell.
                    <TableRow>
                      <TableCell
                        colSpan={columns.length}
                        className="h-auto bg-transparent! p-0"
                        onClick={event => event.stopPropagation()}
                      >
                        {belowRow}
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })
          )}
        </TableBody>
      </Table>
      {showPagination && (
        <CustomPagination
          dataLength={allRows.length}
          itemsPerPage={pageSize}
          onPageChange={handlePageChange}
        />
      )}
    </>
  );
}
