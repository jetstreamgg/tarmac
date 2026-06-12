import { createFileRoute, redirect } from '@tanstack/react-router';
import { FixedIntent } from '@/lib/enums';
import { keepSearch } from '@/lib/navigation';
import { PENDLE_MARKETS, isMarketMatured } from '@/hooks';

// Matured markets have no detail view — they only render as redeem rows on
// the overview — and unknown addresses fall back to the overview too.
export const Route = createFileRoute('/_shell/fixed/market/$marketAddress')({
  beforeLoad: ({ params }) => {
    const lower = params.marketAddress.toLowerCase();
    const market = PENDLE_MARKETS.find(m => m.marketAddress.toLowerCase() === lower);
    if (!market || isMarketMatured(market.expiry)) {
      throw redirect({ to: '/fixed', search: keepSearch, replace: true });
    }
  },
  staticData: { fixedIntent: FixedIntent.MARKET_INTENT }
});
