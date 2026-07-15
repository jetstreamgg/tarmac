import { format } from 'date-fns';
import { Trans } from '@lingui/react/macro';
import { Progress } from '@/components/ui/progress';
import { usePendleMarketsApiData, type PendleMarketConfig } from '@/hooks';
import { formatTimeLeft } from '../utils/formatTimeLeft';
import { computeMaturityWindow } from '../utils/maturityWindow';

/**
 * Elapsed-maturity body for the detail page's "Maturity" section (E1 Figma
 * 486:33863): percentage headline, progress bar, remaining label + date.
 * Window precedence matches TimeToMaturityCard — real start/expiry from the
 * markets API, config expiry with a 180-day fallback window otherwise.
 */
export function PendleMaturityProgress({ market }: { market: PendleMarketConfig }) {
  const { data: marketsApi } = usePendleMarketsApiData();
  const apiData = marketsApi?.[market.marketAddress];

  const expirySec = apiData?.expirySec ?? market.expiry;
  const { pct, remainingSeconds } = computeMaturityWindow({
    expirySec,
    startSec: apiData?.startTimestampSec,
    nowSec: Math.floor(Date.now() / 1000)
  });

  const maturityDateLabel = format(new Date(expirySec * 1000), 'd MMM yyyy');

  return (
    <div className="flex flex-col gap-3" data-testid="pendle-maturity-progress">
      <span className="text-text font-circle text-3xl">{Math.round(pct)}%</span>
      <Progress value={Math.min(100, Math.max(0, pct))} />
      <div className="flex items-center justify-between text-sm">
        <span className="text-textSecondary flex items-center gap-2">
          <span className="bg-bullish h-1 w-1 rounded-full" />
          {remainingSeconds <= 0 ? (
            <Trans>Matured</Trans>
          ) : (
            <Trans>Matures in {formatTimeLeft(remainingSeconds)}</Trans>
          )}
        </span>
        <span className="text-textSecondary">{maturityDateLabel}</span>
      </div>
    </div>
  );
}
