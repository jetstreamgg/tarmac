import { KeyboardEvent, ReactNode, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Trans } from '@lingui/react/macro';
import { cn } from '@/lib/cn';
import { BP, useBreakpointIndex } from '@/hooks';
import type { EarnRiskTier } from '@/hooks';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CellEmpty, CellPercent, CellToken } from '@/components/ui/table-cells';
import { Skeleton } from '@/components/ui/skeleton';
import { TransactionCardFieldGrid } from './TransactionCard';
import { RiskTierMeter } from './RiskMeter';

export type EarnTableColumn = 'token' | 'network' | 'risk' | 'rate' | 'rate30d' | 'tvl' | 'position';

export type EarnTableSort = { column: EarnTableColumn; direction: 'asc' | 'desc' };

export type EarnTableRowItem = {
  id: string;
  name: string;
  /** Editorial "NEW" marker on the token cell (1036:201322, APP-395). */
  isNew?: boolean;
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

/** The Type=Token cell / accordion-card header: iconbox, name, Supply: subline. */
function TokenCell({ row }: { row: EarnTableRowItem }) {
  return (
    <CellToken
      icon={row.icon}
      title={row.name}
      titleSuffix={
        <>
          {row.nameSuffix}
          {row.isNew && (
            <span
              data-testid={`earn-new-badge-${row.id}`}
              className="bg-brand font-circle rounded-full px-1.5 py-0.5 text-[10px] leading-3 font-medium text-white"
            >
              <Trans>NEW</Trans>
            </span>
          )}
        </>
      }
      // Comp 486:22051: the accordion header title is Label 5; the desktop
      // table cell keeps Label 4 from md up.
      titleClassName="text-sm leading-4 tracking-[-0.28px] md:text-base md:leading-[18px] md:tracking-[-0.32px]"
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
  );
}

/**
 * M5 mobile rendering (Figma mobile Table Section 486:22119): one accordion
 * card per opportunity — collapsed shows the token cell + Rate + chevron,
 * expanded adds the remaining columns as a field grid and the Supply / View
 * details actions. Both actions report through onRowSelect (the product page
 * hosts the supply widget); a dedicated supply deep-link is a design/product
 * follow-up flagged on APP-371. Sorting has no mobile affordance in the comp,
 * so the sort headers are desktop-only.
 */
function EarnCardList({ rows, onRowSelect }: Pick<EarnTableProps, 'rows' | 'onRowSelect'>) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div data-testid="earn-opportunities-table" className="flex w-full flex-col gap-0.5">
      {rows.map((row, index) => {
        const isExpanded = expandedId === row.id;
        return (
          <div
            key={row.id}
            data-testid={`earn-row-${row.id}`}
            className={cn(
              'bg-bgSecondary flex flex-col gap-6 p-5 backdrop-blur-[20px]',
              index === 0 && 'rounded-t-3xl',
              index === rows.length - 1 && 'rounded-b-3xl'
            )}
          >
            <button
              type="button"
              data-testid={`earn-card-toggle-${row.id}`}
              aria-expanded={isExpanded}
              onClick={() => setExpandedId(isExpanded ? null : row.id)}
              className="flex w-full items-center justify-between gap-3 text-left"
            >
              <TokenCell row={row} />
              <span className="flex shrink-0 items-center gap-3">
                <span className="flex flex-col items-end gap-1">
                  <span className="font-graphik text-fgSecondary text-xs leading-[18px]">
                    <Trans>Rate</Trans>
                  </span>
                  <span
                    data-testid={`earn-card-rate-${row.id}`}
                    className="font-circle text-fgPrimary text-xs leading-3.5 font-medium tracking-[-0.24px]"
                  >
                    <NumericValue value={row.rate} isLoading={row.isLoading} />
                  </span>
                </span>
                <ChevronDown
                  size={16}
                  className={cn('text-fgSecondary transition-transform', isExpanded && 'rotate-180')}
                  aria-hidden
                />
              </span>
            </button>
            {isExpanded && (
              <>
                <TransactionCardFieldGrid
                  // Comp 486:22051 expanded grid: Label 6 values (the M5
                  // transaction cards keep their Label 5 default).
                  valueClassName="text-xs leading-3.5 tracking-[-0.24px]"
                  fields={[
                    ...(row.network ? [{ label: <Trans>Network</Trans>, value: row.network }] : []),
                    { label: <Trans>Risk</Trans>, value: <RiskTierMeter tier={row.risk} /> },
                    {
                      label: <Trans>Rate</Trans>,
                      value: <NumericValue value={row.rate} isLoading={row.isLoading} />
                    },
                    {
                      label: <Trans>30D Rate</Trans>,
                      value: <NumericValue value={row.rate30d} isLoading={row.isLoading} />
                    },
                    {
                      label: <Trans>TVL</Trans>,
                      value: <NumericValue value={row.tvl} isLoading={row.isLoading} />
                    },
                    {
                      label: <Trans>My position</Trans>,
                      value: <NumericValue value={row.position} isLoading={row.isLoading} />
                    }
                  ]}
                />
                <div className="flex w-full items-center gap-3">
                  <Button variant="primary" size="m" className="flex-1" onClick={() => onRowSelect?.(row.id)}>
                    <Trans>Supply</Trans>
                  </Button>
                  <Button
                    variant="secondary"
                    size="m"
                    className="flex-1"
                    onClick={() => onRowSelect?.(row.id)}
                  >
                    <Trans>View details</Trans>
                  </Button>
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * The Earn Opportunities table (Figma Table/Earn 5178:37463): layout only —
 * rows arrive filtered, sorted and formatted; sorting/selection intent is
 * reported via callbacks. Surface, header and hover come from ui/table.
 * Below the md tier it reflows into accordion cards (EarnCardList).
 */
export function EarnTable({ rows, sort, onSortChange, onRowSelect }: EarnTableProps) {
  const { bpi } = useBreakpointIndex();

  const handleRowKeyDown = (event: KeyboardEvent, id: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onRowSelect?.(id);
    }
  };

  if (bpi < BP.md) return <EarnCardList rows={rows} onRowSelect={onRowSelect} />;

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
            {/* The Figma active-position iconbox (CellToken `active`) is not
                wired here on purpose: its trigger follows product logic that
                is not part of the H8 batch. */}
            <TableCell>
              <TokenCell row={row} />
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
