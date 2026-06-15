import { createFileRoute } from '@tanstack/react-router';
import { RewardsPanes } from '@/modules/rewards/components/RewardsPanes';
import { Intent } from '@/lib/enums';

export const Route = createFileRoute('/_shell/earn/rewards')({
  component: RewardsPanes,
  staticData: { intent: Intent.REWARDS_INTENT }
});
