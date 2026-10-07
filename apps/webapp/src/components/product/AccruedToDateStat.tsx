import { Trans } from '@lingui/react/macro';
import { ProductStat } from '@/components/product/ProductCard';
import { EarningsFigureValue } from '@/modules/portfolio/components/EarningsStat';
import type { PositionEarnings } from '@/modules/portfolio/earnings/earningsForPosition';

/**
 * The position cards' "Accrued to date" stat: the same per-row slice the
 * Portfolio renders for the position (APP-450), as a plain figure that greys
 * out while it is anything but a settled number.
 */
export function AccruedToDateStat({ accrued, testId }: { accrued: PositionEarnings | null; testId: string }) {
  return (
    <ProductStat label={<Trans>Accrued to date</Trans>}>
      <EarningsFigureValue
        figure={accrued?.totalEarned ?? null}
        missing={accrued?.missingFromTotal}
        coverage={accrued?.coverage}
        pendleSplit={accrued?.pendleSplit}
        variant="plain"
        className={accrued?.totalEarned?.status === 'ok' ? undefined : 'text-fgSecondary'}
        skeletonClassName="h-4 w-14"
        testId={testId}
      />
    </ProductStat>
  );
}
