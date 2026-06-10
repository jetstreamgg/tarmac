import { createFileRoute } from '@tanstack/react-router';
import { Intent } from '@/lib/enums';

export const Route = createFileRoute('/_shell/rewards')({
  staticData: { intent: Intent.REWARDS_INTENT }
});
