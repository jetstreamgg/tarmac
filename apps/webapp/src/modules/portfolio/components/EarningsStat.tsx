import type { ReactNode } from 'react';
import { Trans } from '@lingui/react/macro';
import { Info } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatUsd } from '@/utils';
import { GainValue } from '@/components/ui/GainValue';
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
  type EarningsFigure,
  type EarningsSourceId,
  type Maybe,
  type NotAvailableReason,
  type PendleSplit,
  type WalletEarnings
} from '../earnings/types';

// APP-450 stat rendering, shared by the earnings-card footer and the position
// cards. Guiding rule carried from the data layer: a wrong number is worse
// than no number — anything notAvailable renders a dash with an explanation,
// and a combined figure missing sources says so instead of posing as complete.

const SOURCE_LABELS: Record<EarningsSourceId, ReactNode> = {
  'morpho-flagship': <Trans>Morpho vault</Trans>,
  merkl: <Trans>Merkl rewards</Trans>,
  pendle: <Trans>Pendle</Trans>,
  savings: <Trans>Sky Savings Rate</Trans>,
  stusds: <Trans>stUSDS</Trans>
};

const REASON_COPY: Record<NotAvailableReason, ReactNode> = {
  'merkl-monthly-unsupported': <Trans>Merkl doesn&apos;t break rewards down by month.</Trans>,
  'stusds-not-listed': <Trans>Not yet available.</Trans>,
  'savings-disabled': <Trans>Coming soon.</Trans>,
  'source-error': <Trans>Temporarily unavailable.</Trans>,
  'reconciliation-failed': <Trans>We couldn&apos;t verify this figure, so it&apos;s hidden.</Trans>,
  disconnected: <Trans>Connect your wallet to see earnings.</Trans>,
  loading: <Trans>Loading…</Trans>
};

function EarningsTooltip({ trigger, children }: { trigger: ReactNode; children: ReactNode }) {
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

export type MissingSourceDetail = { id: EarningsSourceId; reason: NotAvailableReason };

/** Resolves the combined stat's missing-source ids to their reasons. */
export function missingSourceDetails(
  earnings: WalletEarnings,
  field: 'total' | 'month'
): MissingSourceDetail[] {
  const ids = field === 'total' ? earnings.combined.missingFromTotal : earnings.combined.missingFromMonth;
  return ids.map(id => {
    const protocol = earnings.protocols.find(p => p.id === id);
    const figure = field === 'total' ? protocol?.totalEarned : protocol?.earnedThisMonth;
    return { id, reason: figure?.status === 'notAvailable' ? figure.reason : 'source-error' };
  });
}

function MissingList({ missing }: { missing: MissingSourceDetail[] }) {
  return (
    <div className="flex flex-col gap-1">
      <span>
        <Trans>Not included:</Trans>
      </span>
      {missing.map(({ id, reason }) => (
        <span key={id}>
          {SOURCE_LABELS[id]}: {REASON_COPY[reason]}
        </span>
      ))}
    </div>
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
  testId
}: {
  earnings: WalletEarnings;
  field: 'total' | 'month';
  className?: string;
  testId: string;
}) {
  if (earnings.isLoading) {
    return <Skeleton data-testid="earnings-stat-skeleton" className="h-[18px] w-24 rounded" />;
  }

  const missing = missingSourceDetails(earnings, field);
  if (missing.length === earnings.protocols.length && missing.length > 0) {
    return (
      <span data-testid={testId}>
        <EarningsTooltip
          trigger={
            <span tabIndex={0} className={cn(className, 'text-textSecondary')}>
              —
            </span>
          }
        >
          <MissingList missing={missing} />
        </EarningsTooltip>
      </span>
    );
  }

  const usd = field === 'total' ? earnings.combined.totalEarnedUsd : earnings.combined.earnedThisMonthUsd;
  const hasErrorGap = missing.some(m => !isAnnouncedGap(m.reason));
  return (
    <span data-testid={testId} className="flex items-center gap-1.5">
      <GainValue value={usd} signed className={className} />
      {missing.length > 0 && (
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
          <MissingList missing={missing} />
        </EarningsTooltip>
      )}
    </span>
  );
}

/**
 * A single position's figure: `null` marks a row outside APP-450 scope (plain
 * dash), a notAvailable figure explains itself in a tooltip ('loading' shows
 * the skeleton instead), and an ok Pendle figure carries the realized vs
 * mark-to-market split in its tooltip.
 */
export function EarningsFigureValue({
  figure,
  variant,
  className,
  testId,
  pendleSplit,
  skeletonClassName = 'h-[18px] w-16 rounded'
}: {
  figure: Maybe<EarningsFigure> | null;
  /** 'gain' renders the signed GainValue treatment; 'plain' bare formatUsd. */
  variant: 'gain' | 'plain';
  className?: string;
  testId?: string;
  pendleSplit?: PendleSplit;
  skeletonClassName?: string;
}) {
  if (figure?.status === 'notAvailable' && figure.reason === 'loading') {
    return <Skeleton data-testid="earnings-stat-skeleton" className={skeletonClassName} />;
  }

  if (!figure || figure.status === 'notAvailable') {
    const dash = (
      <span tabIndex={figure ? 0 : undefined} className={className}>
        —
      </span>
    );
    return (
      <span data-testid={testId}>
        {figure ? <EarningsTooltip trigger={dash}>{REASON_COPY[figure.reason]}</EarningsTooltip> : dash}
      </span>
    );
  }

  const value =
    variant === 'gain' ? (
      <GainValue value={figure.value.usd} signed className={className} />
    ) : (
      <span className={className}>{formatUsd(figure.value.usd)}</span>
    );

  if (pendleSplit) {
    return (
      <span data-testid={testId}>
        <EarningsTooltip
          trigger={
            <span tabIndex={0} data-testid="earnings-pendle-split">
              {value}
            </span>
          }
        >
          <div className="flex flex-col gap-1">
            <span>
              <Trans>Realized: {formatUsd(pendleSplit.realizedUsd)}</Trans>
            </span>
            <span>
              <Trans>Unrealized (mark to market): {formatUsd(pendleSplit.markToMarketUsd)}</Trans>
            </span>
          </div>
        </EarningsTooltip>
      </span>
    );
  }

  return <span data-testid={testId}>{value}</span>;
}
