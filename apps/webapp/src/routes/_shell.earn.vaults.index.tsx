import { createFileRoute, redirect } from '@tanstack/react-router';
import { ROUTES } from '@/lib/routes';

// The bare /earn/vaults path has no screen of its own anymore — the Earn
// marketplace lists the vaults and each vault's page lives at
// /earn/vaults/$provider/$vaultAddress. Forward to /earn, preserving global
// search params (e.g. ?network=). Redirecting here (not on the parent) keeps
// the detail route reachable.
export const Route = createFileRoute('/_shell/earn/vaults/')({
  beforeLoad: ({ search }) => {
    throw redirect({ to: ROUTES.EARN, search, replace: true });
  }
});
