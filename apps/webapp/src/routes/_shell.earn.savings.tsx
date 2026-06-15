import { createFileRoute } from '@tanstack/react-router';
import { SavingsProductDetail } from '@/modules/savings/components/SavingsProductDetail';
import { Intent } from '@/lib/enums';

// Savings is the first ProductDetailTemplate consumer (C3). Keeps its intent
// for orchestration/network validation, but renders full-width (bare) like the
// /earn marketplace instead of the legacy two-pane SavingsPanes.
export const Route = createFileRoute('/_shell/earn/savings')({
  component: SavingsProductDetail,
  staticData: { intent: Intent.SAVINGS_INTENT, fullWidth: true }
});
