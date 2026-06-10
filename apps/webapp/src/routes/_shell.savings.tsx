import { createFileRoute } from '@tanstack/react-router';
import { Intent } from '@/lib/enums';

export const Route = createFileRoute('/_shell/savings')({
  staticData: { intent: Intent.SAVINGS_INTENT }
});
