import { createFileRoute, redirect } from '@tanstack/react-router';
import { Intent } from '@/lib/enums';
import { keepSearch } from '@/lib/navigation';
import { providerForVaultModule } from '@/lib/vaults/vaultProviderMapping';
import { VAULTS } from '@/hooks';

// An unrecognised provider segment or an address that belongs to no known
// vault of that provider falls back to the vaults overview. Which chain the
// vault lives on is resolved by the panes (chain-dependent).
export const Route = createFileRoute('/_shell/vaults/$provider/$vaultAddress')({
  beforeLoad: ({ params }) => {
    const provider = providerForVaultModule(params.provider);
    const address = params.vaultAddress.toLowerCase();
    const isKnownVault =
      !!provider &&
      VAULTS.some(
        v => v.provider === provider && Object.values(v.vaultAddress).some(a => a?.toLowerCase() === address)
      );
    if (!isKnownVault) {
      throw redirect({ to: '/vaults', search: keepSearch, replace: true });
    }
  },
  staticData: { intent: Intent.VAULTS_INTENT }
});
