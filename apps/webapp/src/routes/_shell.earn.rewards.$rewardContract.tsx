import { createFileRoute } from '@tanstack/react-router';
import { RewardsDetailPage } from '@/modules/rewards/components/RewardsDetailPage';
import { Intent } from '@/lib/enums';

// Reward contract validity is chain-dependent (wagmi state), so it is enforced
// in useAppOrchestration's route-validation effect rather than here. Renders
// full-width through the ProductDetailTemplate (D6), like Savings/Vaults.
export const Route = createFileRoute('/_shell/earn/rewards/$rewardContract')({
  component: RewardsDetailPage,
  staticData: { intent: Intent.REWARDS_INTENT, fullWidth: true }
});
