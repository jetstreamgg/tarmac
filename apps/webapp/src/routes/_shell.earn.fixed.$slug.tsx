import { useEffect } from 'react';
import { createFileRoute, Navigate, redirect, useRouterState } from '@tanstack/react-router';
import { FixedIntent } from '@/lib/enums';
import { keepSearch } from '@/lib/navigation';
import { getPendleMarketBySlug, isMarketMatured } from '@/hooks';
import { PendleProductDetail } from '@/modules/pendle/components/PendleProductDetail';
import { requireModuleEnabled } from '@/modules/geo-config/routeGuard';
import { trackRouteRedirected } from '@/modules/analytics/lib/trackRouteRedirected';

// Market details render full-width through the ProductDetailTemplate (E1).
// Matured markets have no detail view — they redirect to the Portfolio, whose
// ready-to-redeem section is where redemption lives (G6) — and unknown slugs
// fall back to the Earn marketplace.
export const Route = createFileRoute('/_shell/earn/fixed/$slug')({
  // `!preload` keeps link-hover preloads from emitting phantom redirects.
  beforeLoad: async ({ context, params, location, search, preload }) => {
    const market = getPendleMarketBySlug(params.slug);
    if (!market) {
      if (!preload) {
        trackRouteRedirected({ fromPath: location.pathname, toPath: '/earn', reason: 'unknown_market' });
      }
      throw redirect({ to: '/earn', search: keepSearch, replace: true });
    }
    if (isMarketMatured(market.expiry)) {
      if (!preload) {
        trackRouteRedirected({ fromPath: location.pathname, toPath: '/portfolio', reason: 'market_matured' });
      }
      throw redirect({ to: '/portfolio', search: keepSearch, replace: true });
    }
    // Slug validity resolves first, so an unknown slug still lands on the
    // marketplace rather than implying the market exists but is restricted.
    await requireModuleEnabled(context.queryClient, 'fixed', location.searchStr, search);
  },
  component: PendleMarketDetail,
  staticData: { fixedIntent: FixedIntent.MARKET_INTENT }
});

function PendleMarketDetail() {
  const { slug } = Route.useParams();
  const pathname = useRouterState({ select: s => s.location.pathname });
  const market = getPendleMarketBySlug(slug);
  // beforeLoad guarantees a live market; the re-check keeps the render safe if
  // the market matures while the page is mounted.
  const redirectToPortfolio = !market || isMarketMatured(market.expiry);
  useEffect(() => {
    if (redirectToPortfolio) {
      trackRouteRedirected({ fromPath: pathname, toPath: '/portfolio', reason: 'market_matured' });
    }
  }, [redirectToPortfolio, pathname]);
  if (redirectToPortfolio) {
    return <Navigate to="/portfolio" search={keepSearch} replace />;
  }
  return <PendleProductDetail market={market} />;
}
