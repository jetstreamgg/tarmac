import { ReactNode } from 'react';
import { Trans } from '@lingui/react/macro';
import { AudioLines, Asterisk, Vault, Droplet, UsersRound } from 'lucide-react';
import { useStakeHistoricData, RISK_LEVEL_THRESHOLDS, RiskLevel } from '@/hooks';
import { formatNumber, formatDecimalPercentage } from '@/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useStakeRewardsRate } from '../hooks/useStakeRewardsRate';

const NO_VALUE = '–';

// Trailing 6-month window, in days, used to average the historic rewards rate.
const SIX_MONTH_DAYS = 183;

// Structural subset of RewardsChartInfoParsed: seconds timestamp + decimal-
// fraction rate string, as the BA Labs farms endpoint delivers them.
type RatePoint = { blockTimestamp: number; rate: string };

/**
 * Mean of the historic rewards `rate` over the trailing 6 months relative to
 * the most recent datapoint. Pure and structurally typed so the test can hit it
 * directly without standing up the hook. Returns null when there is no data in
 * the window. (Rewards — not borrow — rate per the product call on the F1
 * review; 6M window semantics flagged for confirmation in PRD Decision 7.)
 */
export function calculateTrailing6MonthRate(data: readonly RatePoint[] | undefined): number | null {
  if (!data || data.length === 0) return null;
  const sorted = [...data].sort((a, b) => b.blockTimestamp - a.blockTimestamp);
  const cutoff = sorted[0].blockTimestamp - SIX_MONTH_DAYS * 24 * 60 * 60;
  const windowPoints = sorted.filter(point => point.blockTimestamp >= cutoff);
  if (windowPoints.length === 0) return null;
  const sum = windowPoints.reduce((acc, point) => acc + parseFloat(point.rate), 0);
  return Number.isFinite(sum) ? sum / windowPoints.length : null;
}

// Static risk meter: iterate the canonical thresholds low→high and tint each
// segment along the green→red status spectrum. Semantic tokens only — the exact
// amber/orange mid-hues are a design-review concern, not new token families.
const RISK_SEGMENT_COLOR: Record<RiskLevel, string> = {
  [RiskLevel.LOW]: 'bg-bullish',
  [RiskLevel.MEDIUM]: 'bg-bullish/50',
  [RiskLevel.HIGH]: 'bg-error/60',
  [RiskLevel.LIQUIDATION]: 'bg-error'
};
const RISK_LEVELS_ASCENDING = [...RISK_LEVEL_THRESHOLDS].sort((a, b) => a.threshold - b.threshold);

function DetailRow({ icon, label, children }: { icon: ReactNode; label: ReactNode; children: ReactNode }) {
  return (
    <div className="border-textSecondary/10 flex items-center justify-between gap-4 border-b py-3">
      <span className="text-textSecondary flex items-center gap-2 text-sm">
        <span className="text-textSecondary flex h-4 w-4 items-center justify-center" aria-hidden>
          {icon}
        </span>
        {label}
      </span>
      <span className="text-text flex items-center text-sm font-medium">{children}</span>
    </div>
  );
}

// Skeleton while the backing hook loads; a dash on error — mirrors how the
// legacy StakeOverview surfaces the same hooks.
function StatValue({
  isLoading,
  error,
  children
}: {
  isLoading?: boolean;
  error?: Error | null;
  children: ReactNode;
}) {
  if (isLoading) return <Skeleton className="h-4 w-16" />;
  if (error) return <>{NO_VALUE}</>;
  return <>{children}</>;
}

/**
 * Statistics-tab "Details" strip: the hi-fi label/value rows fed entirely by the
 * existing read hooks. Read-only — no engine hook is touched here.
 */
export function StakeDetailsStrip() {
  const { data: historicData, isLoading: historicLoading, error: historicError } = useStakeHistoricData();
  const mostRecent = historicData
    ?.slice()
    .sort((a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime())[0];

  // Rewards rate (highest-rate farm) — the same figure the promo card and the
  // Statistics chart hero show, so all three rate surfaces agree.
  const {
    series: rewardsSeries,
    currentRate,
    isLoading: rewardsLoading,
    error: rewardsError
  } = useStakeRewardsRate();

  const sixMonthRate = calculateTrailing6MonthRate(rewardsSeries);

  return (
    <div data-testid="stake-details-strip" className="flex flex-col">
      <h3 className="text-text mb-2 text-lg font-medium">
        <Trans>Details</Trans>
      </h3>

      <div className="grid grid-cols-2 gap-x-5">
        <DetailRow icon={<AudioLines className="h-4 w-4" />} label={<Trans>Current Rate</Trans>}>
          <StatValue isLoading={rewardsLoading} error={rewardsError}>
            {currentRate !== null ? formatDecimalPercentage(currentRate) : NO_VALUE}
          </StatValue>
        </DetailRow>

        <DetailRow icon={<AudioLines className="h-4 w-4" />} label={<Trans>6M Rate</Trans>}>
          <StatValue isLoading={rewardsLoading} error={rewardsError}>
            {sixMonthRate !== null ? formatDecimalPercentage(sixMonthRate) : NO_VALUE}
          </StatValue>
        </DetailRow>

        <DetailRow icon={<Asterisk className="h-4 w-4" />} label={<Trans>Risk scale</Trans>}>
          <span className="flex w-28 gap-0.5" aria-hidden>
            {RISK_LEVELS_ASCENDING.map(({ level }) => (
              <span key={level} className={`h-1.5 flex-1 rounded-full ${RISK_SEGMENT_COLOR[level]}`} />
            ))}
          </span>
        </DetailRow>

        <DetailRow icon={<Vault className="h-4 w-4" />} label={<Trans>TVL</Trans>}>
          <StatValue isLoading={historicLoading} error={historicError}>
            {mostRecent ? `$${formatNumber(mostRecent.tvl)}` : NO_VALUE}
          </StatValue>
        </DetailRow>

        <DetailRow icon={<Droplet className="h-4 w-4" />} label={<Trans>Liquidity</Trans>}>
          <Trans>Unlimited</Trans>
        </DetailRow>

        <DetailRow icon={<UsersRound className="h-4 w-4" />} label={<Trans>Users</Trans>}>
          <StatValue isLoading={historicLoading} error={historicError}>
            {mostRecent ? formatNumber(mostRecent.numberOfUrns, { maxDecimals: 0 }) : NO_VALUE}
          </StatValue>
        </DetailRow>
      </div>
    </div>
  );
}
