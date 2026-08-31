import { createFileRoute } from '@tanstack/react-router';
import { Intent } from '@/lib/enums';

// Pure layout passthrough: the per-contract detail lives at $rewardContract
// and the bare /earn/rewards index redirects to the Earn marketplace — the
// legacy overview pane was retired with D6.
export const Route = createFileRoute('/_shell/earn/rewards')({
  staticData: { intent: Intent.REWARDS_INTENT }
});
