import { createFileRoute } from '@tanstack/react-router';
import { Intent } from '@/lib/enums';

export const Route = createFileRoute('/_shell/')({
  staticData: { intent: Intent.BALANCES_INTENT }
});
