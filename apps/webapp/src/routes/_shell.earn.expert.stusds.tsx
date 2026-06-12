import { createFileRoute } from '@tanstack/react-router';
import { ExpertIntent } from '@/lib/enums';

// Gated on the expert risk disclaimer in useAppOrchestration's route-validation
// effect (user settings live in React context).
export const Route = createFileRoute('/_shell/earn/expert/stusds')({
  staticData: { expertIntent: ExpertIntent.STUSDS_INTENT }
});
