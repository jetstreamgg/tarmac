import { useEffect } from 'react';
import { createFileRoute, Navigate, redirect, useRouterState } from '@tanstack/react-router';
import { FixedIntent } from '@/lib/enums';
import { keepSearch } from '@/lib/navigation';
import { getPendleMarketBySlug } from '@/hooks';
import { PendleProductDetail } from '@/modules/pendle/components/PendleProductDetail';
import { requireModuleEnabled } from '@/modules/geo-config/routeGuard';
import { trackRouteRedirected } from '@/modules/analytics/lib/trackRouteRedirected';

// Market details render full-width through the ProductDetailTemplate (E1).
// Matured markets keep their detail view — the page swaps its position card
// for the claim layout (Figma 2193:73881) and the Maturity section reads 100%
// — so only unknown slugs fall back to the Earn marketplace. The market stays
// out of the marketplace rows and every supply entry point; it is reachable
// from the Earn "Requires action" section and the Portfolio.
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
  // beforeLoad already redirected an unknown slug; the re-check keeps the
  // render safe (and typed) if the registry changes while the page is mounted.
  useEffect(() => {
    if (!market) {
      trackRouteRedirected({ fromPath: pathname, toPath: '/earn', reason: 'unknown_market' });
    }
  }, [market, pathname]);
  if (!market) {
    return <Navigate to="/earn" search={keepSearch} replace />;
  }
  return <PendleProductDetail market={market} />;
}
