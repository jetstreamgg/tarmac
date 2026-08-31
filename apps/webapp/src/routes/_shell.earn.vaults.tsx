import { createFileRoute } from '@tanstack/react-router';
import { Intent } from '@/lib/enums';

// Pure layout passthrough: vault details live at $provider/$vaultAddress and
// the bare /earn/vaults index redirects to the Earn marketplace — the legacy
// overview panes were retired with G6, following /earn/fixed and /earn/rewards.
export const Route = createFileRoute('/_shell/earn/vaults')({
  staticData: { intent: Intent.VAULTS_INTENT }
});
