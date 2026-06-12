import { createFileRoute } from '@tanstack/react-router';
import { Intent } from '@/lib/enums';

// Reward contract validity is chain-dependent (wagmi state), so it is enforced
// in useAppOrchestration's route-validation effect rather than here.
export const Route = createFileRoute('/_shell/rewards/$rewardContract')({
  staticData: { intent: Intent.REWARDS_INTENT }
});
