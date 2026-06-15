import { createFileRoute } from '@tanstack/react-router';
import { VaultsPanes } from '@/modules/vaults/components/VaultsPanes';
import { Intent } from '@/lib/enums';

export const Route = createFileRoute('/_shell/earn/vaults')({
  component: VaultsPanes,
  staticData: { intent: Intent.VAULTS_INTENT }
});
