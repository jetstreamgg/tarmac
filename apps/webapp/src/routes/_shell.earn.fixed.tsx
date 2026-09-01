import { createFileRoute } from '@tanstack/react-router';
import { Intent } from '@/lib/enums';

// Pure layout passthrough: market details live at $slug and the bare
// /earn/fixed index redirects to the Earn marketplace — the legacy overview
// panes were retired with G6 (matured-PT redemption moved to the Portfolio).
export const Route = createFileRoute('/_shell/earn/fixed')({
  staticData: { intent: Intent.FIXED_INTENT }
});
