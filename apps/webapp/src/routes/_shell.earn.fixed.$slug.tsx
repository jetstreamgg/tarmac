import { createFileRoute, Navigate, redirect } from '@tanstack/react-router';
import { FixedIntent } from '@/lib/enums';
import { keepSearch } from '@/lib/navigation';
import { getPendleMarketBySlug, isMarketMatured } from '@/hooks';
import { PendleProductDetail } from '@/modules/pendle/components/PendleProductDetail';

// Market details render full-width through the ProductDetailTemplate (E1).
// Matured markets have no detail view — they redirect to the Portfolio, whose
// ready-to-redeem section is where redemption lives (G6) — and unknown slugs
// fall back to the Earn marketplace.
export const Route = createFileRoute('/_shell/earn/fixed/$slug')({
  beforeLoad: ({ params }) => {
    const market = getPendleMarketBySlug(params.slug);
    if (!market) {
      throw redirect({ to: '/earn', search: keepSearch, replace: true });
    }
    if (isMarketMatured(market.expiry)) {
      throw redirect({ to: '/portfolio', search: keepSearch, replace: true });
    }
  },
  component: PendleMarketDetail,
  staticData: { fixedIntent: FixedIntent.MARKET_INTENT, fullWidth: true }
});

function PendleMarketDetail() {
  const { slug } = Route.useParams();
  const market = getPendleMarketBySlug(slug);
  // beforeLoad guarantees a live market; the re-check keeps the render safe if
  // the market matures while the page is mounted.
  if (!market || isMarketMatured(market.expiry)) {
    return <Navigate to="/portfolio" search={keepSearch} replace />;
  }
  return <PendleProductDetail market={market} />;
}
