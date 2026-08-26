import { Trans } from '@lingui/react/macro';
import { Progress } from '@/components/ui/progress';
import { usePendleMarketsApiData, type PendleMarketConfig } from '@/hooks';
import { formatTimeLeft } from '../utils/formatTimeLeft';
import { computeMaturityWindow } from '../utils/maturityWindow';
import { formatMaturity } from '@/modules/earn/helpers/formatMaturity';

/**
 * Elapsed-maturity body for the detail page's "Maturity" section (Figma
 * 859:40960): Heading 3 percentage, progress bar, remaining label + date.
 * Window precedence matches TimeToMaturityCard — real start/expiry from the
 * markets API, config expiry with a 180-day fallback window otherwise.
 *
 * The comp gives the meta row a fg-brand-primary dot, Body 5 fg-secondary copy
 * and — the part APP-432 item 14 flagged — a **fg-primary** maturity date, not
 * the secondary tint the whole row used to share.
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

  const maturityDateLabel = formatMaturity(expirySec);

  return (
    <div className="flex flex-col gap-3" data-testid="pendle-maturity-progress">
      <span className="text-text font-circle text-[32px] leading-[35px] font-medium tracking-[-0.64px]">
        {Math.round(pct)}%
      </span>
      <Progress value={Math.min(100, Math.max(0, pct))} />
      <div className="flex items-center justify-between">
        <span className="text-fgSecondary font-graphik flex items-center gap-2 text-sm leading-[22px]">
          <span className="bg-fgBrand size-1 rounded-full" />
          {remainingSeconds <= 0 ? (
            <Trans>Matured</Trans>
          ) : (
            <Trans>Matures in {formatTimeLeft(remainingSeconds)}</Trans>
          )}
        </span>
        <span className="text-text font-circle text-base leading-[18px] font-medium tracking-[-0.32px]">
          {maturityDateLabel}
        </span>
      </div>
    </div>
  );
}
