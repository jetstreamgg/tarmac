import { createFileRoute, redirect } from '@tanstack/react-router';
import { ROUTES } from '@/lib/routes';
import { keepSearchFilteredTo } from '@/lib/navigation';
import { Intent } from '@/lib/enums';

// The bare /earn/vaults path has no screen of its own — the Earn marketplace
// lists the vaults and each vault's page lives at
// /earn/vaults/$provider/$vaultAddress. Forward to the marketplace filtered to
// vaults (APP-542), preserving global search params (e.g. ?network=).
// Redirecting here (not on the parent) keeps the detail route reachable.
export const Route = createFileRoute('/_shell/earn/vaults/')({
  beforeLoad: () => {
    throw redirect({ to: ROUTES.EARN, search: keepSearchFilteredTo(Intent.VAULTS_INTENT), replace: true });
  }
});
