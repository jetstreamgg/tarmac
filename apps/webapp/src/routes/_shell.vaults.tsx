import { createFileRoute } from '@tanstack/react-router';
import { Intent } from '@/lib/enums';

export const Route = createFileRoute('/_shell/vaults')({
  staticData: { intent: Intent.VAULTS_INTENT }
});
