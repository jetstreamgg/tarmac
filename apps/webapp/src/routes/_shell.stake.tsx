import { createFileRoute } from '@tanstack/react-router';
import { StakeProductPage } from '@/modules/stake/components/StakeProductPage';
import { Intent } from '@/lib/enums';
import { requireModuleEnabled } from '@/modules/geo-config/routeGuard';

// Stake is a destination page (F7 flip): keeps its intent for orchestration
// and network validation, and renders full-width like the /earn marketplace.
export const Route = createFileRoute('/_shell/stake')({
  beforeLoad: ({ context, location, search }) =>
    requireModuleEnabled(context.queryClient, 'stake', location.searchStr, search),
  component: StakeProductPage,
  staticData: { intent: Intent.STAKE_INTENT }
});
