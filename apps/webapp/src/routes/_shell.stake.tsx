import { createFileRoute } from '@tanstack/react-router';
import { StakeProductPage } from '@/modules/stake/components/StakeProductPage';
import { Intent } from '@/lib/enums';

// Stake is a destination page (F7 flip): keeps its intent for orchestration
// and network validation, but renders full-width (bare) like the /earn
// marketplace instead of the legacy two-pane StakePanes.
export const Route = createFileRoute('/_shell/stake')({
  component: StakeProductPage,
  staticData: { intent: Intent.STAKE_INTENT, fullWidth: true }
});
