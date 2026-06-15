import { createFileRoute } from '@tanstack/react-router';
import { SavingsPanes } from '@/modules/savings/components/SavingsPanes';
import { Intent } from '@/lib/enums';

export const Route = createFileRoute('/_shell/earn/savings')({
  component: SavingsPanes,
  staticData: { intent: Intent.SAVINGS_INTENT }
});
