import { ReactNode } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { Trans } from '@lingui/react/macro';
import { cn } from '@/lib/cn';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * The product-detail transactions table (Figma C3, reworked from HistoryTable).
 * Presentational + reusable: every module-specific visual (action icon, token
 * icons) is injected as a slot; the owning module maps its history hook to these
 * rows. Lives in components/product per the layer rule.
 */

export type ProductTransactionStatus = 'pending' | 'completed';

export interface ProductTransactionAmount {
  /** Token icon node, injected by the module. */
  icon: ReactNode;
  amount: ReactNode;
  /** Optional USD sub-value under the amount. */
  usd?: ReactNode;
}

export interface ProductTransactionRow {
  id: string;
  /** Action glyph (Supply/Withdraw/…), injected by the module. */
  actionIcon: ReactNode;
  actionLabel: ReactNode;
  timeAgo: ReactNode;
  status: ProductTransactionStatus;
  from: ProductTransactionAmount;
  to: ProductTransactionAmount;
  /** Truncated hash label (e.g. "0xff9s…dsa6"). */
  txHashLabel: ReactNode;
  /** Block-explorer URL for the transaction. */
  txHref: string;
}

export interface ProductTransactionsTableProps {
  rows?: ProductTransactionRow[];
  isLoading?: boolean;
  error?: Error | null;
  emptyLabel?: ReactNode;
  dataTestId?: string;
}

const GRID = 'grid grid-cols-[1.5fr_1fr_1fr_1fr_1fr] items-center gap-4';

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

function StatusBadge({ status }: { status: ProductTransactionStatus }) {
  if (status === 'pending') {
    return (
      <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[#A299F7]/10 px-2.5 py-1 text-xs font-medium text-[#A299F7]">
        <DotsIcon />
        <Trans>Pending</Trans>
      </span>
    );
  }
  return (
    <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[#5AD293]/10 px-2.5 py-1 text-xs font-medium text-[#5AD293]">
      <CheckIcon />
      <Trans>Completed</Trans>
    </span>
  );
}

function AmountCell({ amount }: { amount: ProductTransactionAmount }) {
  return (
    <div className="flex items-center gap-2">
      <span className="shrink-0">{amount.icon}</span>
      <div className="flex flex-col">
        <span className="text-text text-sm">{amount.amount}</span>
        {amount.usd && <span className="text-textSecondary text-xs">{amount.usd}</span>}
      </div>
    </div>
  );
}

function StateRow({ children }: { children: ReactNode }) {
  return (
    <div className="bg-container text-textSecondary rounded-2xl px-4 py-8 text-center text-sm">
      {children}
    </div>
  );
}

export function ProductTransactionsTable({
  rows,
  isLoading,
  error,
  emptyLabel,
  dataTestId = 'product-transactions'
}: ProductTransactionsTableProps) {
  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-[680px] flex-col gap-2" data-testid={dataTestId}>
        <div className={cn(GRID, 'text-textSecondary px-4 text-sm')}>
          <span>
            <Trans>Action</Trans>
          </span>
          <span>
            <Trans>Status</Trans>
          </span>
          <span>
            <Trans>From</Trans>
          </span>
          <span>
            <Trans>To</Trans>
          </span>
          <span>
            <Trans>Txn hash</Trans>
          </span>
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
              key={row.id}
              className={cn(
                GRID,
                'bg-container hover:bg-containerDark rounded-2xl px-4 py-3 transition-colors'
              )}
            >
              <div className="flex items-center gap-3">
                <span className="border-borderPrimary text-text flex h-9 w-9 shrink-0 items-center justify-center rounded-full border">
                  {row.actionIcon}
                </span>
                <div className="flex flex-col">
                  <span className="text-text text-sm font-medium">{row.actionLabel}</span>
                  <span className="text-textSecondary text-xs">{row.timeAgo}</span>
                </div>
              </div>
              <div>
                <StatusBadge status={row.status} />
              </div>
              <AmountCell amount={row.from} />
              <AmountCell amount={row.to} />
              <a
                href={row.txHref}
                target="_blank"
                rel="noreferrer"
                className="text-textSecondary hover:text-text flex w-fit items-center gap-1 text-sm transition-colors"
              >
                {row.txHashLabel}
                <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
