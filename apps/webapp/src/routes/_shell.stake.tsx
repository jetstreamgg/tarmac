import { createFileRoute } from '@tanstack/react-router';
import { Intent } from '@/lib/enums';

export const Route = createFileRoute('/_shell/stake')({
  staticData: { intent: Intent.STAKE_INTENT }
});
