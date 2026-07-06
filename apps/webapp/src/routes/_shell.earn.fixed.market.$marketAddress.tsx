import { createFileRoute, redirect } from '@tanstack/react-router';
import { keepSearch } from '@/lib/navigation';
import { getPendleMarketByAddress } from '@/hooks';

// Legacy address-based detail path — market details moved to /earn/fixed/:slug
// (E1). Known addresses forward to their slug route (its beforeLoad handles
// maturity); unknown addresses fall back to the overview.
export const Route = createFileRoute('/_shell/earn/fixed/market/$marketAddress')({
  beforeLoad: ({ params }) => {
    const market = getPendleMarketByAddress(params.marketAddress as `0x${string}`);
    if (market) {
      throw redirect({
        to: '/earn/fixed/$slug',
        params: { slug: market.slug },
        search: keepSearch,
        replace: true
      });
    }
    throw redirect({ to: '/earn/fixed', search: keepSearch, replace: true });
  }
});
