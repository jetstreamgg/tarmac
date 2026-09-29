import { ReactNode, useCallback, useEffect, useState } from 'react';
import { Trans } from '@lingui/react/macro';
import { useAccount, useChainId } from 'wagmi';
import { formatPercent } from '@/utils';
import { Plus } from 'lucide-react';
import { formatStakeAmount } from '../lib/formatStakeAmount';
import { loanToValue } from '../lib/loanToValue';
import { cn } from '@/lib/cn';
import { QueryParams } from '@/lib/constants';
import { useAppSearchParams } from '@/lib/navigation';
import { StakeSky, Liquidated, SuppliedEmpty } from '@/modules/icons';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { Button } from '@/components/ui/button';
import { StakeEmptySection } from './StakeEmptySection';
import { RiskPill } from './StakeManageBorrowCard';
import { IconboxPosition, type IconboxPositionTone } from '@/components/ui/iconbox';
import { RiskLevel } from '@/hooks';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { RISK_ZONE_FILL } from '@/components/product/RiskMeter';
import {
  ProductTransactionsTable,
  ProductTransactionColumn
} from '@/components/product/ProductTransactionsTable';
import { TransactionCard, TransactionCardSkeleton } from '@/components/product/TransactionCard';
import { CardField, CardFieldDivider, CardFieldRow } from '@/components/product/CardFields';
import { CellAmount, CellPosition } from '@/components/ui/table-cells';
import { useConnectThenAct } from '@/modules/ui/context/ConnectThenActContext';
import {
  StakeUserPosition,
  isInactiveStakePosition,
  isLiquidatedStakePosition
} from '../hooks/useStakeUserPositions';
import { StakePositionRowBanner } from './StakePositionRowBanner';
import { StakePositionDetailWarmer } from './StakePositionDetailWarmer';
import { useStakeRowVault, useStakeRowVaultLookup } from '../hooks/useStakeRowVault';
import {
  DEFAULT_STAKE_POSITIONS_SORT,
  nextStakePositionsSort,
  sortStakePositions,
  type StakePositionsSort,
  type StakePositionsSortColumn
} from '../lib/positionsSort';
import { ariaSortFor, SortHeaderButton } from '@/components/product/SortHeaderButton';
import { recallStakePositionCount, rememberStakePositionCount } from '../lib/positionCountMemory';

/** Filled pill badge replacing the risk meter once a position has been liquidated. */
function LiquidatedBadge() {
  return (
    <span
      data-testid="stake-position-liquidated-badge"
      className="bg-error/15 text-error font-circle inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
    >
      <Liquidated width={16} height={16} />
      <Trans>Liquidation</Trans>
    </span>
  );
}

/** Liquidation-risk cell: liquidated badge, the vault's risk pill for urns with debt, or a dash. */
function PositionRiskCell({ position }: { position: StakeUserPosition }) {
  const hasDebt = position.usdsDebt > 0n;
  // Computed from the list's own Vat snapshot: no per-row read, so the meter
  // lands with the amounts instead of after them.
  const { data: vault, isLoading, error } = useStakeRowVault(position);

  const isLiquidated = isLiquidatedStakePosition(position);
  if (isLiquidated) return <LiquidatedBadge />;
  if (hasDebt && isLoading) return <Skeleton className="h-5 w-14" />;
  if (hasDebt && error && !vault) {
    // A failed read on a debt-carrying urn must not render the unlit
    // "no risk" meter — that masks a position that may be near liquidation.
    return (
      <span data-testid="stake-position-risk-unavailable" className="text-textSecondary text-sm">
        –
      </span>
    );
  }
  if (isLiquidated === undefined && isInactiveStakePosition(position)) {
    // No bark history (subgraph down) on an emptied urn: it may be a
    // liquidated one, so neither the badge nor the unlit meter is honest.
    return (
      <span data-testid="stake-position-liquidation-unknown" className="text-textSecondary text-sm">
        –
      </span>
    );
  }
  if (!hasDebt || !vault?.riskLevel) return <NoValueCell testId="stake-position-risk-none" />;
  return (
    <RiskPill riskLevel={vault.riskLevel} size="m" dataTestId={`stake-position-risk-${position.index}`} />
  );
}

/** Comp 3617:24023: debt-free rows read "-" in fg-tertiary for LTV and risk. */
function NoValueCell({ testId }: { testId: string }) {
  return (
    <span data-testid={testId} className="text-fgTertiary">
      -
    </span>
  );
}

/** Loan-to-value cell: debt / collateral value from the list's Vat snapshot. */
function PositionLtvCell({ position }: { position: StakeUserPosition }) {
  const { data: vault, isLoading } = useStakeRowVault(position);
  if (position.usdsDebt === 0n) return <NoValueCell testId="stake-position-ltv-none" />;
  if (isLoading) return <Skeleton className="h-5 w-12" />;
  const ltv = loanToValue(vault?.debtValue, vault?.collateralValue);
  if (ltv === undefined) return <NoValueCell testId="stake-position-ltv-unavailable" />;
  // Comp 3617:24391: a 48×3 track filled to the LTV, tinted by the risk zone.
  const ltvFraction = Math.min(1, Math.max(0, Number(ltv) / 1e18));
  return (
    <span className="flex items-center gap-[11px]">
      {vault?.riskLevel && (
        <span aria-hidden className="bg-sliderTrack relative h-[3px] w-12 shrink-0 rounded-full">
          <span
            data-testid={`stake-position-ltv-bar-${position.index}`}
            className={cn(
              'absolute inset-y-0 left-0 rounded-full bg-linear-to-r',
              RISK_ZONE_FILL[vault.riskLevel]
            )}
            style={{ width: `${ltvFraction * 100}%` }}
          />
        </span>
      )}
      <span data-testid={`stake-position-ltv-${position.index}`}>
        {formatPercent(ltv, { showPercentageDecimals: false })}
      </span>
    </span>
  );
}

/**
 * Borrowed cell: LIVE debt (principal + accrued interest). `position.usdsDebt`
 * is the Vat's `art × rate` from `useStakeUrnVaults` — the same figure
 * `useVault` derives — so no per-row read is needed here.
 */
function PositionBorrowedCell({ position }: { position: StakeUserPosition }) {
  return (
    <CellAmount
      icon={<TokenIcon token={{ symbol: 'USDS' }} width={12} className="h-3 w-3" showChainIcon={false} />}
      amount={
        <span className={cn(position.usdsDebt === 0n && 'text-fgSecondary')}>
          {formatStakeAmount(position.usdsDebt)}
        </span>
      }
    />
  );
}

const RISK_TONE: Record<RiskLevel, IconboxPositionTone> = {
  [RiskLevel.LOW]: 'success',
  [RiskLevel.MEDIUM]: 'warning',
  [RiskLevel.HIGH]: 'error',
  [RiskLevel.LIQUIDATION]: 'error'
};

// Iconbox colour follows liquidation risk; staking-only (or risk still loading) stays info.
function usePositionTone(position: StakeUserPosition): IconboxPositionTone {
  const { data: vault } = useStakeRowVault(position);
  return position.usdsDebt > 0n && vault?.riskLevel ? RISK_TONE[vault.riskLevel] : 'info';
}

function PositionIdCell({ position }: { position: StakeUserPosition }) {
  const inactive = isInactiveStakePosition(position);
  const tone = usePositionTone(position);
  return (
    // Inactive positions read through Iconbox/Position's own Inactive variant
    // (Figma 5051:145321) rather than a blanket opacity — the comp keeps the
    // label at full-strength fg-primary and only neutralizes the mark.
    // The shared table turns fr weights into percentages summing to 100%, so
    // the px tracks hold their width through a content floor (150 - 24 - 8).
    <div data-testid={`stake-position-id-${position.index}`} className="min-w-[118px]">
      <CellPosition
        icon={<StakeSky width={16} height={16} />}
        label={<Trans>#{position.index + 1}</Trans>}
        inactive={inactive}
        tone={tone}
      />
    </div>
  );
}

const stakedCell = (position: StakeUserPosition) => (
  <CellAmount
    icon={<TokenIcon token={{ symbol: 'SKY' }} width={12} className="h-3 w-3" showChainIcon={false} />}
    amount={formatStakeAmount(position.skyLocked)}
  />
);

/** Rows whose details-modal reads warm on load; the rest warm on hover/focus/touch. */
export const STAKE_PREFETCH_ROWS = 3;
// ProductTransactionsTable's default page size; the skeleton never exceeds one page.
const STAKE_PAGE_SIZE = 7;

const SORTABLE_COLUMNS: {
  id: StakePositionsSortColumn;
  label: ReactNode;
  width: string;
  cell: (position: StakeUserPosition) => ReactNode;
}[] = [
  {
    id: 'position',
    label: (
      <span className="whitespace-nowrap">
        <Trans>Position ID</Trans>
      </span>
    ),
    width: '150px',
    cell: position => <PositionIdCell position={position} />
  },
  { id: 'staked', label: <Trans>Staked (SKY)</Trans>, width: '1fr', cell: stakedCell },
  {
    id: 'borrowed',
    label: <Trans>Borrowed (USDS)</Trans>,
    width: '1fr',
    cell: position => <PositionBorrowedCell position={position} />
  },
  {
    id: 'ltv',
    label: <Trans>Loan-to-value</Trans>,
    width: '1fr',
    cell: position => <PositionLtvCell position={position} />
  },
  {
    id: 'risk',
    label: <Trans>Liquidation risk</Trans>,
    width: '1fr',
    cell: position => <PositionRiskCell position={position} />
  }
];

const MANAGE_COLUMN: ProductTransactionColumn<StakeUserPosition> = {
  id: 'manage',
  header: null,
  width: '104px',
  skeleton: false,
  cell: position => (
    // 104 - 2 × 8 padding.
    <div className="min-w-[88px]">
      <Button
        variant="secondary"
        size="s"
        className="mx-auto flex w-20 px-2"
        data-testid={`stake-position-manage-${position.index}`}
      >
        <Trans>Manage</Trans>
      </Button>
    </div>
  )
};

// Comp 3617:24023: every data header sorts (3617:25270). The Manage button just bubbles into the row click.
function buildColumns(
  sort: StakePositionsSort,
  onSort: (column: StakePositionsSortColumn) => void
): ProductTransactionColumn<StakeUserPosition>[] {
  return [
    ...SORTABLE_COLUMNS.map(({ id, label, width, cell }) => {
      const isSorted = sort.column === id;
      return {
        id,
        width,
        cell,
        ariaSort: ariaSortFor(isSorted, sort.direction),
        header: (
          <SortHeaderButton
            label={label}
            isSorted={isSorted}
            direction={sort.direction}
            onClick={() => onSort(id)}
            dataTestId={`stake-positions-sort-${id}`}
          />
        )
      };
    }),
    MANAGE_COLUMN
  ];
}

// Mobile position card (comp 1222:16771 / 1295:21684): 36px position iconbox
// with a Label 4 title, equal-column CardField pairs split by centered
// hairlines, and a full-width secondary "View more" footer. The card wrapper
// still owns the tap-to-manage behavior (the engine wires onRowClick to it);
// the button simply bubbles into that same handler.
function PositionIconbox({ position }: { position: StakeUserPosition }) {
  const tone = usePositionTone(position);
  return (
    <IconboxPosition inactive={isInactiveStakePosition(position)} tone={tone}>
      <StakeSky width={16} height={16} />
    </IconboxPosition>
  );
}

const renderCard = (position: StakeUserPosition) => (
  <TransactionCard
    header={
      <span className="flex items-center gap-3" data-testid={`stake-position-id-${position.index}`}>
        {/* Same inactive treatment as the desktop cell: the variant, not opacity. */}
        <PositionIconbox position={position} />
        <span className="text-fgPrimary font-circle text-base leading-[18px] font-medium tracking-[-0.32px]">
          <Trans>#{position.index + 1}</Trans>
        </span>
      </span>
    }
    footer={
      <>
        <div className="flex w-full flex-col gap-6">
          <CardFieldRow>
            <CardField label={<Trans>Staked (SKY)</Trans>}>{stakedCell(position)}</CardField>
            <CardFieldDivider />
            <CardField label={<Trans>Borrowed (USDS)</Trans>}>
              <PositionBorrowedCell position={position} />
            </CardField>
          </CardFieldRow>
          <CardFieldRow>
            <CardField label={<Trans>Loan-to-value</Trans>}>
              <PositionLtvCell position={position} />
            </CardField>
            <CardFieldDivider />
            <CardField label={<Trans>Liquidation risk</Trans>}>
              <PositionRiskCell position={position} />
            </CardField>
          </CardFieldRow>
        </div>
        <Button variant="secondary" size="m" className="w-full">
          <Trans>View more</Trans>
        </Button>
      </>
    }
  />
);

/**
 * Active-positions table (hi-fi 486:31830 / component 486:32084): one row per
 * staking urn with a "Hide inactive positions" toggle (emptied urns stay
 * on-chain forever, so they stay listed behind it). Row click stages the F5
 * management modal via `flow=manage&urn_index=N` — nothing mounts on those
 * params until F5, same stub contract as the F2 open-position CTA.
 */
export function StakePositionsTable({
  positions,
  isLoading,
  error,
  contextError,
  onRemediate
}: {
  positions?: StakeUserPosition[];
  isLoading: boolean;
  error?: Error | null;
  /**
   * Subgraph failure: rows are live but carry no bark history, so liquidated
   * urns can't be told from emptied ones. Disables the hide-inactive toggle
   * (with a hint); the filter itself stands down per row via `barks: undefined`.
   */
  contextError?: Error | null;
  /** Warning-banner CTA: stage the given remediation action for that position's manage sheet. */
  onRemediate: (position: StakeUserPosition, action: 'stake' | 'repay') => void;
}) {
  const { isConnected, address } = useAccount();
  const chainId = useChainId();
  const [showInactive, setShowInactive] = useState(false);
  const [sort, setSort] = useState<StakePositionsSort>(DEFAULT_STAKE_POSITIONS_SORT);
  const { vaultOf } = useStakeRowVaultLookup();
  const [intentIndices, setIntentIndices] = useState<Set<number>>(() => new Set());
  const [, setSearchParams] = useAppSearchParams();

  const onRowClick = useCallback(
    (position: StakeUserPosition) => {
      setSearchParams(
        params => {
          params.set(QueryParams.Flow, 'manage');
          params.set(QueryParams.UrnIndex, String(position.index));
          return params;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const allPositions = positions ?? [];
  // An emptied urn only hides when it is known NOT to be liquidated: a
  // liquidated one stays listed, and so does one whose bark history is
  // unknown (subgraph down — `isLiquidatedStakePosition` is undefined).
  const filteredPositions = !showInactive
    ? allPositions.filter(
        position => !isInactiveStakePosition(position) || isLiquidatedStakePosition(position) !== false
      )
    : allPositions;
  const visiblePositions = sortStakePositions(filteredPositions, sort, vaultOf);
  const columns = buildColumns(sort, column => setSort(previous => nextStakePositionsSort(previous, column)));
  const filterUnavailable = Boolean(contextError);
  const isEmpty = !isLoading && !error && allPositions.length === 0;

  const openPosition = useCallback(() => {
    setSearchParams(
      params => {
        params.set(QueryParams.Flow, 'open');
        return params;
      },
      { replace: true }
    );
  }, [setSearchParams]);
  const onOpenPosition = useConnectThenAct(openPosition, 'stake_open');

  // The skeleton is sized to this wallet's last known row count so the table
  // does not resize when the live rows land; the count is stored once they do.
  const rememberedCount = recallStakePositionCount(chainId, address);
  const visibleCount = visiblePositions.length;
  useEffect(() => {
    if (isLoading || error || !address || visibleCount === 0) return;
    rememberStakePositionCount(chainId, address, visibleCount);
  }, [isLoading, error, address, chainId, visibleCount]);

  // Details-modal prefetch: the first rows warm on load (most owners have 1–2
  // positions), the rest when the pointer/focus lands on them. Everything is
  // keyed on the urn index so a re-sort or filter never re-warms.
  const warmIndices = new Set([
    ...visiblePositions.slice(0, STAKE_PREFETCH_ROWS).map(position => position.index),
    ...intentIndices
  ]);

  // Comp 3617:23840: the title sits above a dashed box, with no table chrome.
  if (isEmpty) {
    return (
      <StakeEmptySection
        testId="stake-positions-empty"
        title={<Trans>Active positions</Trans>}
        illustration={<SuppliedEmpty aria-hidden />}
      >
        {isConnected ? (
          <Trans>You don&apos;t have any staking and borrowing position yet.</Trans>
        ) : (
          <Trans>Connect your wallet to see your positions.</Trans>
        )}
      </StakeEmptySection>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {[...warmIndices].map(index => (
        <StakePositionDetailWarmer key={index} urnIndex={index} />
      ))}
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-text font-circle text-lg leading-[22px] font-medium tracking-[-0.36px]">
          <Trans>Active positions</Trans>
        </h3>
        {/* Label 5 on fg-primary (comp 3617:24023). */}
        {allPositions.length > 0 && (
          <div className="flex flex-col items-end gap-1">
            <label
              className={cn(
                'text-fgPrimary font-circle flex items-center gap-3 text-sm leading-4 font-medium tracking-[-0.28px]',
                filterUnavailable ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
              )}
            >
              {/* Comp 1222:16843 shortens the label at the phone tier. */}
              <span className="md:hidden">
                <Trans>Show inactive</Trans>
              </span>
              <span className="hidden md:inline">
                <Trans>Show inactive positions</Trans>
              </span>
              <Switch
                checked={showInactive || filterUnavailable}
                onCheckedChange={setShowInactive}
                disabled={filterUnavailable}
                data-testid="stake-show-inactive-toggle"
              />
            </label>
            {/* Without bark history the filter can't tell an emptied urn from a
                liquidated one, so every position is shown and the switch is
                inert — say so rather than leave a toggle that does nothing. */}
            {filterUnavailable && (
              <span
                data-testid="stake-show-inactive-unavailable"
                className="text-textSecondary font-circle text-xs leading-4"
              >
                <Trans>Liquidation history unavailable — showing all positions</Trans>
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <ProductTransactionsTable
          dataTestId="stake-positions-table"
          columns={columns}
          rows={visiblePositions}
          rowKey={position => String(position.index)}
          rowTestId={position => `stake-position-row-${position.index}`}
          onRowClick={onRowClick}
          onRowIntent={position =>
            setIntentIndices(previous =>
              previous.has(position.index) ? previous : new Set(previous).add(position.index)
            )
          }
          isLoading={isLoading}
          error={error}
          emptyLabel={<Trans>No active positions.</Trans>}
          emptyIllustration={<SuppliedEmpty aria-hidden />}
          renderCard={renderCard}
          cardSkeleton={<TransactionCardSkeleton fieldRows={2} fieldRowGapClassName="gap-6" />}
          loadingRows={rememberedCount ? Math.min(rememberedCount, STAKE_PAGE_SIZE) : undefined}
          renderBelowRow={position => (
            <StakePositionRowBanner
              position={position}
              onRemediate={action => onRemediate(position, action)}
              onClaim={() => onRowClick(position)}
            />
          )}
        />
        {!isLoading && !error && (
          <button
            type="button"
            onClick={onOpenPosition}
            data-testid="stake-open-position-card"
            className="border-glassBorder text-fgSecondary hover:text-fgPrimary font-circle flex h-[88px] w-full items-center justify-center gap-2 rounded-3xl border border-dashed text-sm leading-4 font-medium tracking-[-0.28px] backdrop-blur-[20px] transition-colors"
          >
            <Plus className="size-4" aria-hidden />
            <Trans>Open a new position</Trans>
          </button>
        )}
      </div>
    </div>
  );
}
