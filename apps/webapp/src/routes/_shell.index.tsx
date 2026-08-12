import { createFileRoute, redirect } from '@tanstack/react-router';
import { ROUTES } from '@/lib/routes';
import { readLastPortfolioDecision } from '@/lib/portfolioDecisionCache';

// The root path has no screen of its own — it forwards to the visitor's home
// (Routing & IA decision #3 / APP-295): Portfolio when the last wallet that
// settled here had a significant position (`outcome: 'none'` suppresses the
// onboarding callouts), Earn for everyone else — first visits, disconnected
// visitors, and wallets that settled without a position. The cached decision
// is the only synchronous signal (wagmi hasn't resolved an address yet), so
// this stays flicker-free: no loading pass, no land-then-redirect.
//
// Legacy ?widget= / pre-flip-path deep links are already rewritten in __root's
// beforeLoad (which throws first), so only a bare "/" reaches here. Global
// search params (e.g. ?network=) are preserved.
export const Route = createFileRoute('/_shell/')({
  beforeLoad: ({ search }) => {
    const last = readLastPortfolioDecision();
    const to = last?.outcome === 'none' ? ROUTES.PORTFOLIO : ROUTES.EARN;
    throw redirect({ to, search, replace: true });
  }
});
