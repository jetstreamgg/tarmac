import { createFileRoute } from '@tanstack/react-router';
import { LegacyPanes } from '@/modules/app/components/LegacyPanes';
import { Intent } from '@/lib/enums';

export const Route = createFileRoute('/_shell/')({
  component: LegacyPanes,
  staticData: { intent: Intent.BALANCES_INTENT }
});
