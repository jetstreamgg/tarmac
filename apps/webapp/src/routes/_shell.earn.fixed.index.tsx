import { createFileRoute, redirect } from '@tanstack/react-router';
import { ROUTES } from '@/lib/routes';

// The bare /earn/fixed path has no screen of its own anymore (G6) — the Earn
// marketplace lists the live markets, each market's page lives at
// /earn/fixed/$slug, and matured-PT redemption moved to the Portfolio.
// Forward to /earn, preserving global search params (e.g. ?network=).
// Redirecting here (not on the parent) keeps the $slug detail route reachable.
export const Route = createFileRoute('/_shell/earn/fixed/')({
  beforeLoad: ({ search }) => {
    throw redirect({ to: ROUTES.EARN, search, replace: true });
  }
});
