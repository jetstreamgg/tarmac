import { createFileRoute } from '@tanstack/react-router';
import { EarnPage } from '@/modules/earn/components/EarnPage';

// No staticData.intent: Earn is a destination, not a module (no Intent maps to it).
export const Route = createFileRoute('/_shell/earn/')({
  component: EarnPage
});
