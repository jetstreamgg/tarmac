import { createFileRoute } from '@tanstack/react-router';
import { SavingsProductDetail } from '@/modules/savings/components/SavingsProductDetail';
import { Intent } from '@/lib/enums';
import { requireModuleEnabled } from '@/modules/geo-config/routeGuard';

// Savings is the first ProductDetailTemplate consumer (C3). Keeps its intent
// for orchestration/network validation, and renders full-width like the /earn
// marketplace.
export const Route = createFileRoute('/_shell/earn/savings')({
  beforeLoad: ({ context, location, search }) =>
    requireModuleEnabled(context.queryClient, 'savings', location.searchStr, search),
  component: SavingsProductDetail,
  staticData: { intent: Intent.SAVINGS_INTENT }
});
