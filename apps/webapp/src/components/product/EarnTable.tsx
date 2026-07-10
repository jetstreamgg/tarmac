import { KeyboardEvent, ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { Trans } from '@lingui/react/macro';
import { cn } from '@/lib/cn';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CellEmpty, CellPercent, CellToken } from '@/components/ui/table-cells';
import { Skeleton } from '@/components/ui/skeleton';
import type { EarnRiskTier } from '@/hooks';
import { RiskTierMeter } from './RiskMeter';

export type EarnTableColumn = 'token' | 'network' | 'risk' | 'rate' | 'rate30d' | 'tvl' | 'position';

export type EarnTableSort = { column: EarnTableColumn; direction: 'asc' | 'desc' };

export type EarnTableRowItem = {
  id: string;
  name: string;
  /** 28px product logo for the token iconbox (the caller injects its TokenIcon). */
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
  /** The user holds a position: mint iconbox border + status dot. */
  hasPosition?: boolean;
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

/**
 * Formatted numeric value → typed cell: percent strings get the dimmed unit
 * (Type=Percent), dash placeholders (EarnPage's en-dash, useEarnMarketplace's
 * em-dash NO_RATE) get Type=Empty, USD strings render as the TableCell
 * default (Type=Text).
 */
function NumericValue({ value, isLoading }: { value: string; isLoading?: boolean }) {
  if (isLoading) return <Skeleton className="h-4 w-12" />;
  if (value === '–' || value === '—') return <CellEmpty />;
  if (value.endsWith('%')) return <CellPercent value={value.slice(0, -1)} />;
  return value;
}

export type EarnTableProps = {
  rows: EarnTableRowItem[];
  sort: EarnTableSort;
  onSortChange: (column: EarnTableColumn) => void;
  onRowSelect?: (id: string) => void;
};

/**
 * The Earn Opportunities table (Figma Table/Earn 5178:37463): layout only —
 * rows arrive filtered, sorted and formatted; sorting/selection intent is
 * reported via callbacks. Surface, header and hover come from ui/table.
 */
export function EarnTable({ rows, sort, onSortChange, onRowSelect }: EarnTableProps) {
  const handleRowKeyDown = (event: KeyboardEvent, id: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onRowSelect?.(id);
    }
  };

  return (
    <Table data-testid="earn-opportunities-table">
      <TableHeader>
        <TableRow>
          {COLUMNS.map(column => {
            const isSorted = sort.column === column.key;
            return (
              <TableHead
                key={column.key}
                className={cn(column.key === 'token' && 'w-[34%]')}
                aria-sort={isSorted ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined}
              >
                <button
                  type="button"
                  data-testid={`earn-sort-${column.key}`}
                  onClick={() => onSortChange(column.key)}
                  className={cn(
                    'hover:text-fgPrimary inline-flex items-center gap-1 transition-colors',
                    isSorted && 'text-fgPrimary'
                  )}
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
            className="cursor-pointer"
          >
            <TableCell>
              <CellToken
                icon={row.icon}
                active={row.hasPosition}
                title={row.name}
                titleSuffix={row.nameSuffix}
                subtitle={
                  <>
                    <Trans>Supply:</Trans>
                    {row.supply}
                    {row.maturityLabel && (
                      <>
                        <span aria-hidden>·</span>
                        {row.maturityLabel}
                      </>
                    )}
                  </>
                }
              />
            </TableCell>
            <TableCell>{row.network}</TableCell>
            <TableCell>
              <RiskTierMeter tier={row.risk} />
            </TableCell>
            <TableCell>
              <NumericValue value={row.rate} isLoading={row.isLoading} />
            </TableCell>
            <TableCell>
              <NumericValue value={row.rate30d} isLoading={row.isLoading} />
            </TableCell>
            <TableCell>
              <NumericValue value={row.tvl} isLoading={row.isLoading} />
            </TableCell>
            <TableCell>
              <NumericValue value={row.position} isLoading={row.isLoading} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
