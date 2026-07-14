import { createFileRoute, redirect } from '@tanstack/react-router';
import { Intent } from '@/lib/enums';
import { keepSearch } from '@/lib/navigation';
import { providerForVaultModule } from '@/lib/vaults/vaultProviderMapping';
import { VAULTS } from '@/hooks';
import { VaultDetailPage } from '@/modules/vaults/components/VaultDetailPage';

// An unrecognised provider segment or an address that belongs to no known
// vault of that provider falls back to the Earn marketplace. Which chain the
// vault lives on is resolved by the page (chain-dependent).
export const Route = createFileRoute('/_shell/earn/vaults/$provider/$vaultAddress')({
  beforeLoad: ({ params }) => {
    const provider = providerForVaultModule(params.provider);
    const address = params.vaultAddress.toLowerCase();
    const isKnownVault =
      !!provider &&
      VAULTS.some(
        v => v.provider === provider && Object.values(v.vaultAddress).some(a => a?.toLowerCase() === address)
      );
    if (!isKnownVault) {
      throw redirect({ to: '/earn', search: keepSearch, replace: true });
    }
  },
  // Morpho vault details render full-width through the ProductDetailTemplate
  // (D4), like the Savings page. The sky (sUSDT) detail shares this leaf and
  // renders its legacy pane within the full-width shell pending its V2 page.
  component: VaultDetailPage,
  staticData: { intent: Intent.VAULTS_INTENT, fullWidth: true }
});
