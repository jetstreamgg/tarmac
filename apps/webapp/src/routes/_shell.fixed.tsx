import { createFileRoute } from '@tanstack/react-router';
import { PendlePanes } from '@/modules/pendle/components/PendlePanes';
import { Intent } from '@/lib/enums';

export const Route = createFileRoute('/_shell/fixed')({
  component: PendlePanes,
  staticData: { intent: Intent.FIXED_INTENT }
});
