import { ReactNode } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { Trans } from '@lingui/react/macro';
import { cn } from '@/lib/cn';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Reusable transactions table for product-detail pages (Figma C3). Column-driven
 * so each module defines its own columns — Savings/Vaults/Rewards/Stake history
 * differ — while the shared chrome (rounded rows, loading/empty/error states,
 * status pill, common cells) lives here. components/product layer: module-specific
 * visuals are injected through the column `cell` renderers.
 */

export type ProductTransactionStatus = 'pending' | 'completed';

export interface ProductTransactionColumn<T> {
  id: string;
  header: ReactNode;
  /** CSS grid track for this column (e.g. '1.5fr', '1fr', '140px'). */
  width: string;
  cell: (row: T) => ReactNode;
  /** Right-align the header + cell (e.g. amounts). */
  alignEnd?: boolean;
}

export interface ProductTransactionsTableProps<T> {
  columns: ProductTransactionColumn<T>[];
  rows?: T[];
  rowKey: (row: T) => string;
  isLoading?: boolean;
  error?: Error | null;
  emptyLabel?: ReactNode;
  /** Min table width before horizontal scroll kicks in (px). */
  minWidth?: number;
  dataTestId?: string;
}

// --- Reusable cells (compose these in a column's `cell`, or build your own) ---

// The user-supplied status SVGs (colors carried via currentColor).
function DotsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="2.66668" cy="8.66658" r="1.33333" fill="currentColor" />
      <circle cx="7.99999" cy="6.66659" r="1.33333" fill="currentColor" />
      <circle cx="13.3333" cy="8.66658" r="1.33333" fill="currentColor" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M11.3567 2.6484C11.5519 2.84366 11.5519 3.16024 11.3567 3.35551L5.35225 9.35992C5.15699 9.55519 4.84041 9.55519 4.64514 9.35993L0.633753 5.34858C0.43849 5.15332 0.438488 4.83673 0.633749 4.64147C0.82901 4.44621 1.14559 4.44621 1.34086 4.64147L4.99869 8.29926L10.6495 2.6484C10.8448 2.45314 11.1614 2.45314 11.3567 2.6484Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function TxStatusBadge({ status }: { status: ProductTransactionStatus }) {
  if (status === 'pending') {
    return (
      <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[#A299F7]/10 px-2.5 py-1 text-xs font-medium text-[#A299F7]">
        <DotsIcon />
        <Trans>Pending</Trans>
      </span>
    );
  }
  return (
    <span className="text-text inline-flex w-fit items-center gap-1.5 rounded-full bg-[#5AD293]/10 px-2.5 py-1 text-xs font-medium">
      <span className="text-[#5AD293]">
        <CheckIcon />
      </span>
      <Trans>Completed</Trans>
    </span>
  );
}

/** Action cell: a circled glyph + label with an optional relative-time subline. */
export function TxActionCell({
  icon,
  label,
  timeAgo
}: {
  icon: ReactNode;
  label: ReactNode;
  timeAgo?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="border-borderPrimary text-text flex h-9 w-9 shrink-0 items-center justify-center rounded-full border">
        {icon}
      </span>
      <div className="flex flex-col">
        <span className="text-text text-sm font-medium">{label}</span>
        {timeAgo && <span className="text-textSecondary text-xs">{timeAgo}</span>}
      </div>
    </div>
  );
}

/** Amount cell: an optional token icon + amount with an optional USD sub-value. */
export function TxAmountCell({
  icon,
  amount,
  usd
}: {
  icon?: ReactNode;
  amount: ReactNode;
  usd?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      {icon && <span className="shrink-0">{icon}</span>}
      <div className="flex flex-col">
        <span className="text-text text-sm">{amount}</span>
        {usd && <span className="text-textSecondary text-xs">{usd}</span>}
      </div>
    </div>
  );
}

/** Truncated tx-hash with an external-explorer link. */
export function TxHashLink({ label, href }: { label: ReactNode; href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-textSecondary hover:text-text flex w-fit items-center gap-1 text-sm transition-colors"
    >
      {label}
      <ArrowUpRight className="h-3.5 w-3.5" />
    </a>
  );
}

function StateRow({ children }: { children: ReactNode }) {
  return (
    <div className="bg-container text-textSecondary rounded-2xl px-4 py-8 text-center text-sm">
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
  minWidth = 560,
  dataTestId = 'product-transactions'
}: ProductTransactionsTableProps<T>) {
  const gridStyle = { gridTemplateColumns: columns.map(column => column.width).join(' ') };

  return (
    <div className="overflow-x-auto">
      <div className="flex flex-col gap-2" style={{ minWidth }} data-testid={dataTestId}>
        <div className="text-textSecondary grid items-center gap-4 px-4 text-sm" style={gridStyle}>
          {columns.map(column => (
            <span key={column.id} className={cn(column.alignEnd && 'text-right')}>
              {column.header}
            </span>
          ))}
        </div>

        {isLoading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-[60px] rounded-2xl" />
          ))
        ) : error ? (
          <StateRow>
            <Trans>Unable to load transactions, please try again later.</Trans>
          </StateRow>
        ) : !rows || rows.length === 0 ? (
          <StateRow>{emptyLabel ?? <Trans>No transactions yet.</Trans>}</StateRow>
        ) : (
          rows.map(row => (
            <div
              key={rowKey(row)}
              className="bg-container hover:bg-containerDark grid items-center gap-4 rounded-2xl px-4 py-3 transition-colors"
              style={gridStyle}
            >
              {columns.map(column => (
                <div key={column.id} className={cn(column.alignEnd && 'flex justify-end')}>
                  {column.cell(row)}
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
