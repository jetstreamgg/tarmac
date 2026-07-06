import { Intent } from '@/lib/enums';
import { withErrorBoundary } from '@/modules/utils/withErrorBoundary';
import { TwoPane } from '@/modules/app/components/TwoPane';
import { DetailsLayout } from '@/modules/app/components/DetailsLayout';
import { useBreakpointIndex } from '@/modules/ui/hooks/useBreakpointIndex';
import { useRouteEntityParams } from '@/lib/navigation';
import { getPendleMarketBySlug, isMarketMatured } from '@/hooks';
import { PendleWidgetPane } from './PendleWidgetPane';
import { PendleDetailsPane } from './PendleDetailsPane';
import { PendleProductDetail } from './PendleProductDetail';

/** Panes for the Fixed Yield module, including the market detail route. */
export function PendlePanes() {
  const { bpi } = useBreakpointIndex();

  // Market details render on the new full-width ProductDetailTemplate (E1).
  // The route's beforeLoad already bounces unknown/matured slugs; the checks
  // here keep the render safe if a market matures while the page is mounted.
  const slug = useRouteEntityParams().slug;
  const market = slug ? getPendleMarketBySlug(slug) : undefined;
  if (market && !isMarketMatured(market.expiry)) {
    return <PendleProductDetail market={market} />;
  }

  return (
    <TwoPane
      // Remount per breakpoint, matching the legacy widget-pane key
      key={`fixed-${bpi}`}
      widget={withErrorBoundary(<PendleWidgetPane />)}
      details={
        <DetailsLayout intent={Intent.FIXED_INTENT}>
          <PendleDetailsPane />
        </DetailsLayout>
      }
    />
  );
}
