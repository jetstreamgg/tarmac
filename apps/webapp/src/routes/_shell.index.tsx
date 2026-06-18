import { createFileRoute, redirect } from '@tanstack/react-router';
import { ROUTES } from '@/lib/routes';

// The root path has no screen of its own — Portfolio is the canonical home.
// Legacy ?widget= / pre-flip-path deep links are already rewritten in __root's
// beforeLoad (which throws first), so only a bare "/" reaches here; forward it
// to /portfolio, preserving any global search params (e.g. ?network=).
export const Route = createFileRoute('/_shell/')({
  beforeLoad: ({ search }) => {
    throw redirect({ to: ROUTES.PORTFOLIO, search, replace: true });
  }
});
