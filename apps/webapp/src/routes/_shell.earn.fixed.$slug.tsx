import { createFileRoute, redirect } from '@tanstack/react-router';
import { FixedIntent } from '@/lib/enums';
import { keepSearch } from '@/lib/navigation';
import { getPendleMarketBySlug, isMarketMatured } from '@/hooks';

// Matured markets have no detail view — they only render as redeem rows on
// the overview — and unknown slugs fall back to the overview too.
export const Route = createFileRoute('/_shell/earn/fixed/$slug')({
  beforeLoad: ({ params }) => {
    const market = getPendleMarketBySlug(params.slug);
    if (!market || isMarketMatured(market.expiry)) {
      throw redirect({ to: '/earn/fixed', search: keepSearch, replace: true });
    }
  },
  // Market details render full-width through the ProductDetailTemplate (E1),
  // like the Savings and Morpho vault pages; the overview route stays boxed.
  staticData: { fixedIntent: FixedIntent.MARKET_INTENT, fullWidth: true }
});
