import { createFileRoute } from '@tanstack/react-router';
import { ExpertPanes } from '@/modules/expert/components/ExpertPanes';
import { Intent } from '@/lib/enums';

export const Route = createFileRoute('/_shell/expert')({
  component: ExpertPanes,
  staticData: { intent: Intent.EXPERT_INTENT }
});
