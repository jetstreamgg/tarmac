import type { ReactNode } from 'react';
import { Trans } from '@lingui/react/macro';
import { Info } from 'lucide-react';
import { useIsTouchDevice } from '@/hooks';
import { cn } from '@/lib/cn';
import { formatUsd } from '@/utils';
import { formatGainMagnitude, GainValue, isGainNegative } from '@/components/ui/GainValue';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipPortal,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip';
import {
  isAnnouncedGap,
  isMorphoVaultSourceId,
  type EarningsCoverage,
  type EarningsFigure,
  type EarningsSourceId,
  type Maybe,
  type MissingSourceDetail,
  type MorphoVaultSourceId,
  type NotAvailableReason,
  type PendleSplit,
  type WalletEarnings
} from '../earnings/types';

export type { MissingSourceDetail };

// APP-450 stat rendering, shared by the earnings-card footer and the position
// cards. Guiding rule carried from the data layer: a wrong number is worse
// than no number — anything notAvailable renders a dash with an explanation,
// and a combined figure missing sources says so instead of posing as complete.

const SOURCE_LABELS: Record<Exclude<EarningsSourceId, MorphoVaultSourceId>, ReactNode> = {
  merkl: <Trans>Merkl rewards</Trans>,
  pendle: <Trans>Pendle</Trans>,
  savings: <Trans>Sky Savings Rate</Trans>,
  stusds: <Trans>stUSDS</Trans>
};

/** Per-vault Morpho sources carry their vault name; fixed sources use the map. */
const sourceLabel = ({ id, label }: MissingSourceDetail): ReactNode =>
  label ?? (isMorphoVaultSourceId(id) ? <Trans>Morpho vault</Trans> : SOURCE_LABELS[id]);

const REASON_COPY: Record<NotAvailableReason, ReactNode> = {
  'merkl-monthly-unsupported': <Trans>Merkl doesn&apos;t break rewards down by month.</Trans>,
  'source-error': <Trans>Temporarily unavailable.</Trans>,
  'reconciliation-failed': <Trans>We couldn&apos;t verify this figure, so it&apos;s hidden.</Trans>,
  disconnected: <Trans>Connect your wallet to see what you&apos;ve accrued.</Trans>,
  loading: <Trans>Loading…</Trans>
};

/**
 * Every stat-value state renders through this same flex wrapper. A plain inline
 * span would size its line box from the inherited strut (1.5 × 16 = 24px) while
 * the flex row sizes to the value's own `leading-[18px]` box — so states with
 * and without the info glyph would differ in height and the stat would shift
 * vertically as the glyph appears/disappears across hover-focused products
 * (QA finding, 2026-08-24).
 */
export const STAT_ROW = 'flex items-center gap-1.5';

const COVERAGE_COPY: Record<EarningsCoverage, ReactNode> = {
  'mainnet-only': <Trans>Earnings cover Ethereum Mainnet only.</Trans>,
  'rewards-not-included': <Trans>Rewards not included yet.</Trans>
};

function EarningsTooltip({ trigger, children }: { trigger: ReactNode; children: ReactNode }) {
  // The app Tooltip force-closes on touch devices, so the explanations would
  // be unreachable there — fall back to a tap popover styled like the DS
  // tooltip, the InfoTooltip precedent (review finding #7).
  const isTouchDevice = useIsTouchDevice();

  if (isTouchDevice) {
    return (
      <Popover>
        <PopoverTrigger asChild onClick={e => e.stopPropagation()}>
          {trigger}
        </PopoverTrigger>
        <PopoverContent
          align="center"
          side="top"
          className="bg-bgTertiary text-fgPrimary font-graphik w-auto max-w-[260px] rounded-2xl p-4 text-[11px] leading-4 font-normal backdrop-blur-[20px]"
        >
          {children}
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>{trigger}</TooltipTrigger>
        <TooltipPortal>
          <TooltipContent>{children}</TooltipContent>
        </TooltipPortal>
      </Tooltip>
    </TooltipProvider>
  );
}

/** Resolves the combined stat's missing-source ids to their reasons. */
export function missingSourceDetails(
  earnings: WalletEarnings,
  field: 'total' | 'month'
): MissingSourceDetail[] {
  const ids = field === 'total' ? earnings.combined.missingFromTotal : earnings.combined.missingFromMonth;
  return ids.map(id => {
    const protocol = earnings.protocols.find(p => p.id === id);
    const figure = field === 'total' ? protocol?.totalEarned : protocol?.earnedThisMonth;
    return {
      id,
      reason: figure?.status === 'notAvailable' ? figure.reason : 'source-error',
      ...(protocol?.label ? { label: protocol.label } : {})
    };
  });
}

function MissingList({
  missing,
  untrackedNames = []
}: {
  missing: MissingSourceDetail[];
  /** Supplied positions with no earnings source at all (review finding #2). */
  untrackedNames?: string[];
}) {
  return (
    <div className="flex flex-col gap-1">
      <span>
        <Trans>Not included:</Trans>
      </span>
      {missing.map(detail => (
        <span key={detail.id}>
          {sourceLabel(detail)}: {REASON_COPY[detail.reason]}
        </span>
      ))}
      {untrackedNames.map(name => (
        <span key={name}>
          {name}: <Trans>Earnings not tracked yet.</Trans>
        </span>
      ))}
    </div>
  );
}

/**
 * The info glyph beside a partial figure: names the excluded sources in its
 * tooltip, red ('earnings-partial') when any gap is an error rather than an
 * announced product limitation.
 */
function GapGlyph({
  missing,
  untrackedNames = [],
  coverage
}: {
  missing: MissingSourceDetail[];
  untrackedNames?: string[];
  /** Coverage caveat line — announced-class, never flips the glyph to error. */
  coverage?: EarningsCoverage;
}) {
  const hasErrorGap = missing.some(m => !isAnnouncedGap(m.reason));
  return (
    <EarningsTooltip
      trigger={
        <span
          tabIndex={0}
          data-testid={hasErrorGap ? 'earnings-partial' : 'earnings-info'}
          className={cn('flex shrink-0', hasErrorGap ? 'text-error' : 'text-textSecondary')}
        >
          <Info className="h-3 w-3" />
        </span>
      }
    >
      <div className="flex flex-col gap-1">
        {(missing.length > 0 || untrackedNames.length > 0) && (
          <MissingList missing={missing} untrackedNames={untrackedNames} />
        )}
        {coverage && <span>{COVERAGE_COPY[coverage]}</span>}
      </div>
    </EarningsTooltip>
  );
}

/**
 * The plain info glyph beside a stat that just needs a note — same treatment as
 * the gap glyph, minus the missing-source machinery and the error colouring.
 */
export function StatInfoGlyph({ children, testId }: { children: ReactNode; testId?: string }) {
  return (
    <EarningsTooltip
      trigger={
        <span tabIndex={0} data-testid={testId} className="text-textSecondary flex shrink-0">
          <Info className="h-3 w-3" />
        </span>
      }
    >
      {children}
    </EarningsTooltip>
  );
}

/**
 * The combined footer stat: skeleton while the hook loads, a dash when every
 * source is missing, otherwise the signed sum — with an info glyph naming the
 * excluded sources (red when any gap is an error rather than an announced
 * product limitation).
 */
export function CombinedEarningsStat({
  earnings,
  field,
  className,
  testId,
  untrackedNames = [],
  showGapGlyph = true
}: {
  earnings: WalletEarnings;
  field: 'total' | 'month';
  className?: string;
  testId: string;
  /** Supplied positions with no earnings source — the combined figure excludes
   * them, so it must say so (review finding #2). An announced gap, never an error. */
  untrackedNames?: string[];
  /** Set false to render the bare figure without the missing-source info glyph. */
  showGapGlyph?: boolean;
}) {
  if (earnings.isLoading) {
    return <Skeleton data-testid="earnings-stat-skeleton" className="h-[18px] w-24 rounded" />;
  }

  const missing = missingSourceDetails(earnings, field);
  if (missing.length === earnings.protocols.length && missing.length > 0) {
    return (
      <span data-testid={testId} className={STAT_ROW}>
        <EarningsTooltip
          trigger={
            <span tabIndex={0} className={cn(className, 'text-textSecondary')}>
              —
            </span>
          }
        >
          <MissingList missing={missing} untrackedNames={untrackedNames} />
        </EarningsTooltip>
      </span>
    );
  }

  const usd = field === 'total' ? earnings.combined.totalEarnedUsd : earnings.combined.earnedThisMonthUsd;
  return (
    <span data-testid={testId} className={STAT_ROW}>
      <GainValue value={usd} signed className={className} />
      {showGapGlyph && (missing.length > 0 || untrackedNames.length > 0) && (
        <GapGlyph missing={missing} untrackedNames={untrackedNames} />
      )}
    </span>
  );
}

/**
 * A single position's figure: `null` marks a row outside APP-450 scope (plain
 * dash), a notAvailable figure explains itself in a tooltip ('loading' shows
 * the skeleton instead), and an ok Pendle figure carries the realized vs
 * mark-to-market split in its tooltip. A partial sum flags its missing
 * contributors with the same glyph as the combined stat (review finding #1).
 */
export function EarningsFigureValue({
  figure,
  variant,
  className,
  testId,
  missing = [],
  coverage,
  pendleSplit,
  showGapGlyph = true,
  skeletonClassName = 'h-[18px] w-16 rounded'
}: {
  figure: Maybe<EarningsFigure> | null;
  /** 'gain' renders the signed GainValue treatment; 'plain' bare formatUsd. */
  variant: 'gain' | 'plain';
  className?: string;
  testId?: string;
  /** Contributors excluded from a partial figure (per-position missing list). */
  missing?: MissingSourceDetail[];
  /** Coverage caveat for an otherwise-complete figure (review finding #3). */
  coverage?: EarningsCoverage;
  pendleSplit?: PendleSplit;
  /** Set false to render the bare figure without the missing-source info glyph. */
  showGapGlyph?: boolean;
  skeletonClassName?: string;
}) {
  if (figure?.status === 'notAvailable' && figure.reason === 'loading') {
    return <Skeleton data-testid="earnings-stat-skeleton" className={skeletonClassName} />;
  }

  if (!figure || figure.status === 'notAvailable') {
    // `null` = no earnings source for this row; the dash still explains itself
    // (review finding #2: an untracked position must not be silent).
    const dash = (
      <span tabIndex={0} className={className}>
        —
      </span>
    );
    return (
      <span data-testid={testId} className={STAT_ROW}>
        <EarningsTooltip trigger={dash}>
          {figure ? REASON_COPY[figure.reason] : <Trans>Earnings not tracked yet.</Trans>}
        </EarningsTooltip>
      </span>
    );
  }

  const value =
    variant === 'gain' ? (
      <GainValue value={figure.value.usd} signed className={className} />
    ) : (
      <span className={className}>
        {isGainNegative(figure.value.usd) ? '-' : ''}
        {formatGainMagnitude(figure.value.usd)}
      </span>
    );

  const gapGlyph =
    showGapGlyph && (missing.length > 0 || coverage) ? (
      <GapGlyph missing={missing} coverage={coverage} />
    ) : null;

  if (pendleSplit) {
    return (
      <span data-testid={testId} className={STAT_ROW}>
        <EarningsTooltip
          trigger={
            // Also a flex row: as a block it would take the inherited strut's
            // taller line box and undo the wrapper's height normalization.
            <span tabIndex={0} data-testid="earnings-pendle-split" className="flex items-center">
              {value}
            </span>
          }
        >
          <div className="flex flex-col gap-1">
            <span>
              <Trans>Realized: {formatUsd(pendleSplit.realizedUsd)}</Trans>
            </span>
            <span>
              {/* markToMarketUsd is the MTM total; the unrealized slice is what's left after realized. */}
              <Trans>
                Unrealized (mark to market):{' '}
                {formatUsd(pendleSplit.markToMarketUsd - pendleSplit.realizedUsd)}
              </Trans>
            </span>
          </div>
        </EarningsTooltip>
        {gapGlyph}
      </span>
    );
  }

  return (
    <span data-testid={testId} className={STAT_ROW}>
      {value}
      {gapGlyph}
    </span>
  );
}
