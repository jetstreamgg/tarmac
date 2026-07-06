import { createFileRoute, redirect } from '@tanstack/react-router';
import { ROUTES } from '@/lib/routes';

// The bare /earn/rewards path has no screen of its own anymore — the Earn
// marketplace lists the reward farms and each farm's page lives at
// /earn/rewards/$rewardContract. Forward to /earn, preserving global search
// params (e.g. ?network=). Redirecting here (not on the parent) keeps the
// $rewardContract detail route reachable.
export const Route = createFileRoute('/_shell/earn/rewards/')({
  beforeLoad: ({ search }) => {
    throw redirect({ to: ROUTES.EARN, search, replace: true });
  }
});
