import { KeyboardEvent, ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { Trans } from '@lingui/react/macro';
import { cn } from '@/lib/cn';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import type { EarnRiskTier } from '@/hooks';
import { RiskMeter } from './RiskMeter';

export type EarnTableColumn = 'token' | 'network' | 'risk' | 'rate' | 'rate30d' | 'tvl' | 'position';

export type EarnTableSort = { column: EarnTableColumn; direction: 'asc' | 'desc' };

export type EarnTableRowItem = {
  id: string;
  name: string;
  /** Product icon slot (the caller injects its TokenIcon). */
  icon?: ReactNode;
  /** Optional glyph rendered after the name (e.g. a provider logo). */
  nameSuffix?: ReactNode;
  /** Content of the "Supply:" subline (token icons). */
  supply?: ReactNode;
  /** Maturity chip text for fixed-yield rows (e.g. "18 Jun 2026"). */
  maturityLabel?: string;
  /** Stacked network icons slot. */
  network?: ReactNode;
  risk: EarnRiskTier;
  rate: string;
  rate30d: string;
  tvl: string;
  position: string;
  /** Numeric cells render skeletons while true. */
  isLoading?: boolean;
};

const COLUMNS: { key: EarnTableColumn; label: ReactNode }[] = [
  { key: 'token', label: <Trans>Token</Trans> },
  { key: 'network', label: <Trans>Network</Trans> },
  { key: 'risk', label: <Trans>Risk profile</Trans> },
  { key: 'rate', label: <Trans>Rate</Trans> },
  { key: 'rate30d', label: <Trans>30D Rate</Trans> },
  { key: 'tvl', label: <Trans>TVL</Trans> },
  { key: 'position', label: <Trans>My position</Trans> }
];

// Card-style rows: the row spacing comes from border-separate on the table,
// the card surface from the cells (rounded on the outer edges), so the ui
// TableRow's own border/hover treatments are neutralized.
const rowClasses =
  'group/row cursor-pointer border-0 last:border-b-0 has-[td]:hover:bg-transparent has-[td]:active:bg-transparent has-[td]:focus:border-y-0';
const cellClasses =
  'bg-surface group-hover/row:bg-bgHover transition-colors first:rounded-l-2xl last:rounded-r-2xl';

function NumericCell({ value, isLoading }: { value: string; isLoading?: boolean }) {
  return (
    <TableCell className={cellClasses}>{isLoading ? <Skeleton className="h-4 w-12" /> : value}</TableCell>
  );
}

export type EarnTableProps = {
  rows: EarnTableRowItem[];
  sort: EarnTableSort;
  onSortChange: (column: EarnTableColumn) => void;
  onRowSelect?: (id: string) => void;
};

/**
 * The Earn Opportunities table (L1): layout only — rows arrive filtered,
 * sorted and formatted; sorting/selection intent is reported via callbacks.
 */
export function EarnTable({ rows, sort, onSortChange, onRowSelect }: EarnTableProps) {
  const handleRowKeyDown = (event: KeyboardEvent, id: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onRowSelect?.(id);
    }
  };

  return (
    <Table className="border-separate border-spacing-y-2" data-testid="earn-opportunities-table">
      <TableHeader>
        <TableRow>
          {COLUMNS.map(column => {
            const isSorted = sort.column === column.key;
            return (
              <TableHead
                key={column.key}
                aria-sort={isSorted ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined}
              >
                <button
                  type="button"
                  data-testid={`earn-sort-${column.key}`}
                  onClick={() => onSortChange(column.key)}
                  className="hover:text-text inline-flex items-center gap-1 transition-colors"
                >
                  {column.label}
                  <ChevronDown
                    size={12}
                    className={cn(
                      'transition-transform',
                      isSorted ? 'opacity-100' : 'opacity-40',
                      isSorted && sort.direction === 'asc' && 'rotate-180'
                    )}
                  />
                </button>
              </TableHead>
            );
          })}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map(row => (
          <TableRow
            key={row.id}
            data-testid={`earn-row-${row.id}`}
            tabIndex={onRowSelect ? 0 : undefined}
            onClick={() => onRowSelect?.(row.id)}
            onKeyDown={event => handleRowKeyDown(event, row.id)}
            className={rowClasses}
          >
            <TableCell className={cellClasses}>
              <div className="flex items-center gap-3">
                {row.icon}
                <div className="flex flex-col gap-0.5">
                  <span className="flex items-center gap-1.5 font-medium">
                    {row.name}
                    {row.nameSuffix}
                  </span>
                  <span className="text-textSecondary flex items-center gap-1.5 text-xs">
                    <Trans>Supply:</Trans>
                    {row.supply}
                    {row.maturityLabel && (
                      <>
                        <span aria-hidden>·</span>
                        {row.maturityLabel}
                      </>
                    )}
                  </span>
                </div>
              </div>
            </TableCell>
            <TableCell className={cellClasses}>{row.network}</TableCell>
            <TableCell className={cellClasses}>
              <RiskMeter tier={row.risk} />
            </TableCell>
            <NumericCell value={row.rate} isLoading={row.isLoading} />
            <NumericCell value={row.rate30d} isLoading={row.isLoading} />
            <NumericCell value={row.tvl} isLoading={row.isLoading} />
            <NumericCell value={row.position} isLoading={row.isLoading} />
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
