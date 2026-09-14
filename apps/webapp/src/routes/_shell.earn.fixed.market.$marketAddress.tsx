import { createFileRoute, redirect } from '@tanstack/react-router';
import { keepSearch, keepSearchFilteredTo } from '@/lib/navigation';
import { getPendleMarketByAddress } from '@/hooks';
import { Intent } from '@/lib/enums';

// Legacy address-based detail path — market details moved to /earn/fixed/:slug
// (E1). Known addresses forward to their slug route (its beforeLoad handles
// maturity); unknown addresses fall back to the Earn marketplace filtered to
// fixed (APP-542 — G6 retired the /earn/fixed overview).
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
    throw redirect({ to: '/earn', search: keepSearchFilteredTo(Intent.FIXED_INTENT), replace: true });
  }
});
