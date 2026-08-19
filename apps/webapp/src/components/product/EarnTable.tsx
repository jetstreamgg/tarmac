import { KeyboardEvent, ReactNode, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ChevronDown } from 'lucide-react';
import { Trans } from '@lingui/react/macro';
import { AnimationLabels } from '@/modules/ui/animation/constants';
import {
  rowCollapseAnimations,
  rowCollapseContainerAnimations,
  rowCollapseTransition
} from '@/modules/ui/animation/presets';
import { cn } from '@/lib/cn';
import { BP, useBreakpointIndex } from '@/hooks';
import type { EarnRiskProfileId } from '@/hooks';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CellEmpty, CellPercent, CellToken } from '@/components/ui/table-cells';
import { Skeleton } from '@/components/ui/skeleton';
import { TransactionCardFieldGrid } from './TransactionCard';
import { RiskTierDetailsTrigger } from './RiskTierDetails';

export type EarnTableColumn = 'token' | 'network' | 'risk' | 'rate' | 'rate30d' | 'tvl' | 'position';

export type EarnTableSort = { column: EarnTableColumn; direction: 'asc' | 'desc' };

export type EarnTableRowItem = {
  id: string;
  name: string;
  /** Editorial "NEW" marker on the token cell (1036:201322, APP-395). */
  isNew?: boolean;
  /** 28px product logo for the token iconbox (the caller injects its TokenIcon). */
  icon?: ReactNode;
  /** Product-family iconbox tint (Morpho `info` blue, Pendle `success` green) + dot. */
  status?: 'success' | 'info';
  /** Optional glyph rendered after the name (e.g. a provider logo). */
  nameSuffix?: ReactNode;
  /** Content of the "Supply:" subline (token icons). */
  supply?: ReactNode;
  /** Maturity chip text for fixed-yield rows (e.g. "18 Jun 2026"). */
  maturityLabel?: string;
  /** Stacked network icons slot. */
  network?: ReactNode;
  /** Selects the risk tier + details copy (APP-396) — the Risk cell derives everything from it. */
  riskProfile: EarnRiskProfileId;
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
  /**
   * The "Products unavailable in the US" treatment (1036:201476): logos,
   * network/supply stacks and the risk pill drop to 50% opacity, the product
   * name falls to fg-secondary and the values to fg-tertiary, and the row
   * stops responding to hover or selection. Rows in this state have nowhere to
   * go — their module's route redirects to /portfolio.
   */
  dimmed?: boolean;
  /**
   * Namespaces every test id in the table (`{prefix}-row-…`, `{prefix}-sort-…`)
   * so a second table can coexist on the page without colliding with the
   * marketplace's. The default keeps the original ids.
   */
  testIdPrefix?: string;
};

const DEFAULT_TEST_ID_PREFIX = 'earn';

/** 50%-opacity wrapper for the icon slots of a dimmed row. */
function Dim({ dimmed, children }: { dimmed?: boolean; children: ReactNode }) {
  if (!dimmed) return <>{children}</>;
  return <span className="flex opacity-50">{children}</span>;
}

/** The Type=Token cell / accordion-card header: iconbox, name, Supply: subline. */
function TokenCell({ row, dimmed }: { row: EarnTableRowItem; dimmed?: boolean }) {
  return (
    <CellToken
      icon={<Dim dimmed={dimmed}>{row.icon}</Dim>}
      status={row.status}
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
      titleClassName={cn(
        'text-sm leading-4 tracking-[-0.28px] md:text-base md:leading-[18px] md:tracking-[-0.32px]',
        dimmed && 'text-fgSecondary'
      )}
      subtitle={
        <>
          <Trans>Supply:</Trans>
          <Dim dimmed={dimmed}>{row.supply}</Dim>
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
 *
 * `dimmed` cards keep the accordion (the data is still worth reading) but drop
 * both actions — neither destination is reachable from a restricted region.
 * Design has no mobile comp for that section yet (APP-432 item 8).
 */
function EarnCardList({
  rows,
  onRowSelect,
  dimmed,
  testIdPrefix: tid = DEFAULT_TEST_ID_PREFIX
}: Pick<EarnTableProps, 'rows' | 'onRowSelect' | 'dimmed' | 'testIdPrefix'>) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const reduceMotion = useReducedMotion();

  // The 2px card gap is a margin on the card (not the container's gap) so a
  // collapsing card takes its slit with it, and the first/last radii are
  // index-driven with a radius transition so they glide onto the surviving
  // edge card while an exiting one keeps its frozen corners — same recipe as
  // the desktop table.
  return (
    <div data-testid={`${tid}-opportunities-table`} className="flex w-full flex-col">
      <AnimatePresence initial={false}>
        {rows.map((row, index) => {
          const isExpanded = expandedId === row.id;
          return (
            <motion.div
              key={row.id}
              data-testid={`${tid}-row-${row.id}`}
              className="overflow-hidden"
              variants={rowCollapseAnimations}
              initial={AnimationLabels.initial}
              animate={AnimationLabels.animate}
              exit={AnimationLabels.exit}
              transition={reduceMotion ? { duration: 0 } : rowCollapseTransition}
            >
              <div
                className={cn(
                  'bg-bgSecondary flex flex-col gap-6 p-5 backdrop-blur-[20px]',
                  'transition-[margin,border-radius] duration-300',
                  index === 0 ? 'rounded-t-3xl' : 'mt-0.5',
                  index === rows.length - 1 && 'rounded-b-3xl'
                )}
              >
                <button
                  type="button"
                  data-testid={`${tid}-card-toggle-${row.id}`}
                  aria-expanded={isExpanded}
                  onClick={() => setExpandedId(isExpanded ? null : row.id)}
                  className="flex w-full items-center justify-between gap-3 text-left"
                >
                  <TokenCell row={row} dimmed={dimmed} />
                  <span className="flex shrink-0 items-center gap-3">
                    <span className="flex flex-col items-end gap-1">
                      <span className="font-graphik text-fgSecondary text-xs leading-[18px]">
                        <Trans>Rate</Trans>
                      </span>
                      <span
                        data-testid={`${tid}-card-rate-${row.id}`}
                        className={cn(
                          'font-circle text-fgPrimary text-xs leading-3.5 font-medium tracking-[-0.24px]',
                          dimmed && 'text-fgTertiary'
                        )}
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
                      valueClassName={cn(
                        'text-xs leading-3.5 tracking-[-0.24px]',
                        dimmed && 'text-fgTertiary'
                      )}
                      fields={[
                        ...(row.network
                          ? [
                              {
                                label: <Trans>Network</Trans>,
                                value: <Dim dimmed={dimmed}>{row.network}</Dim>
                              }
                            ]
                          : []),
                        {
                          label: <Trans>Risk</Trans>,
                          value: (
                            <Dim dimmed={dimmed}>
                              <RiskTierDetailsTrigger profile={row.riskProfile} />
                            </Dim>
                          )
                        },
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
                    {!dimmed && (
                      <div className="flex w-full items-center gap-3">
                        <Button
                          variant="primary"
                          size="m"
                          className="flex-1"
                          onClick={() => onRowSelect?.(row.id)}
                        >
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
                    )}
                  </>
                )}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

/**
 * The Earn Opportunities table (Figma Table/Earn 5178:37463): layout only —
 * rows arrive filtered, sorted and formatted; sorting/selection intent is
 * reported via callbacks. Surface, header and hover come from ui/table.
 * Below the md tier it reflows into accordion cards (EarnCardList).
 */
export function EarnTable({
  rows,
  sort,
  onSortChange,
  onRowSelect,
  dimmed,
  testIdPrefix: tid = DEFAULT_TEST_ID_PREFIX
}: EarnTableProps) {
  const { bpi } = useBreakpointIndex();
  // A dimmed row has no destination, so selection is off regardless of what
  // the caller passed.
  const handleRowSelect = dimmed ? undefined : onRowSelect;

  const handleRowKeyDown = (event: KeyboardEvent, id: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleRowSelect?.(id);
    }
  };

  if (bpi < BP.md)
    return <EarnCardList rows={rows} onRowSelect={handleRowSelect} dimmed={dimmed} testIdPrefix={tid} />;

  return (
    <Table animateRows data-testid={`${tid}-opportunities-table`}>
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
                  data-testid={`${tid}-sort-${column.key}`}
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
        <AnimatePresence initial={false}>
          {rows.map((row, index) => (
            <TableRow
              key={row.id}
              data-testid={`${tid}-row-${row.id}`}
              tabIndex={handleRowSelect ? 0 : undefined}
              onClick={() => handleRowSelect?.(row.id)}
              onKeyDown={event => handleRowKeyDown(event, row.id)}
              // Presence labels propagate through the plain tds into the cell
              // wrappers, which carry the actual collapse; the row itself uses
              // the label-only container variants (no stagger, no motion).
              variants={rowCollapseContainerAnimations}
              initial={AnimationLabels.initial}
              animate={AnimationLabels.animate}
              exit={AnimationLabels.exit}
              // The hover tint lives on the row surface (TableRow), so
              // neutralizing it means re-declaring the same variant chain with
              // the resting surface. The corner radii are index-driven (not
              // :first-child/:last-child) because an exiting row is still in
              // the DOM: the surviving edge row takes the radius immediately
              // and the surface's border-radius transition glides it in, while
              // the exiting row keeps its frozen corners as it collapses.
              className={cn(
                handleRowSelect ? 'cursor-pointer' : 'has-[td]:hover:[&>td>div>div]:bg-bgSecondary',
                dimmed && '[&>td]:text-fgTertiary',
                index === 0 &&
                  '[&>td:first-child>div>div]:rounded-tl-[24px] [&>td:last-child>div>div]:rounded-tr-[24px]',
                index === rows.length - 1 &&
                  '[&>td:first-child>div>div]:rounded-bl-[24px] [&>td:last-child>div>div]:rounded-br-[24px]'
              )}
            >
              {/* The Figma active-position iconbox (CellToken `active`) is not
                wired here on purpose: its trigger follows product logic that
                is not part of the H8 batch. */}
              <TableCell>
                <TokenCell row={row} dimmed={dimmed} />
              </TableCell>
              <TableCell>
                <Dim dimmed={dimmed}>{row.network}</Dim>
              </TableCell>
              <TableCell>
                <Dim dimmed={dimmed}>
                  <RiskTierDetailsTrigger profile={row.riskProfile} />
                </Dim>
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
        </AnimatePresence>
      </TableBody>
    </Table>
  );
}
