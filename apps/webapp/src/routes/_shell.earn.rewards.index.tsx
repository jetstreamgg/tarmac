import { createFileRoute, redirect } from '@tanstack/react-router';
import { ROUTES } from '@/lib/routes';
import { keepSearchFilteredTo } from '@/lib/navigation';
import { Intent } from '@/lib/enums';

// The bare /earn/rewards path has no screen of its own — the Earn marketplace
// lists the reward farms and each farm's page lives at
// /earn/rewards/$rewardContract. Forward to the marketplace filtered to
// rewards (APP-542), preserving global search params (e.g. ?network=).
// Redirecting here (not on the parent) keeps the $rewardContract detail route
// reachable.
export const Route = createFileRoute('/_shell/earn/rewards/')({
  beforeLoad: () => {
    throw redirect({ to: ROUTES.EARN, search: keepSearchFilteredTo(Intent.REWARDS_INTENT), replace: true });
  }
});
