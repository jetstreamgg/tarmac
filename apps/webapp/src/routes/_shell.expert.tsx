import { createFileRoute } from '@tanstack/react-router';
import { Intent } from '@/lib/enums';

export const Route = createFileRoute('/_shell/expert')({
  staticData: { intent: Intent.EXPERT_INTENT }
});
