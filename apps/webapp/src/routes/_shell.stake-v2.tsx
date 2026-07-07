import { createFileRoute, notFound } from '@tanstack/react-router';
import { StakeProductPage } from '@/modules/stake/components/StakeProductPage';
import { Intent } from '@/lib/enums';

// Dev-only mount for the F2 Stake destination shell. Legacy `/stake` is
// untouched; F7 flips `/stake` to this page and deletes this route. Renders
// full-width like the other destination pages (mirrors routes/dev.tsx gating).
export const Route = createFileRoute('/_shell/stake-v2')({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound();
  },
  component: StakeProductPage,
  staticData: { intent: Intent.STAKE_INTENT, fullWidth: true }
});
