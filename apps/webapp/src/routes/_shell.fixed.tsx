import { createFileRoute } from '@tanstack/react-router';
import { Intent } from '@/lib/enums';

export const Route = createFileRoute('/_shell/fixed')({
  staticData: { intent: Intent.FIXED_INTENT }
});
