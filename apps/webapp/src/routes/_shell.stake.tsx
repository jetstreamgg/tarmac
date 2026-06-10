import { createFileRoute } from '@tanstack/react-router';
import { StakePanes } from '@/modules/stake/components/StakePanes';
import { Intent } from '@/lib/enums';

export const Route = createFileRoute('/_shell/stake')({
  component: StakePanes,
  staticData: { intent: Intent.STAKE_INTENT }
});
