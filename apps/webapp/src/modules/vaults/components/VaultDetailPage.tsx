import { useChainId } from 'wagmi';
import { Navigate } from '@tanstack/react-router';
import { Intent } from '@/lib/enums';
import { withErrorBoundary } from '@/modules/utils/withErrorBoundary';
import { ConnectCard } from '@/modules/layout/components/ConnectCard';
import { useConnectedContext } from '@/modules/ui/context/ConnectedContext';
import { keepSearch, useRouteEntityParams } from '@/lib/navigation';
import { VAULTS } from '@/hooks';
import { VaultsWidgetPane } from './VaultsWidgetPane';
import { VaultDetails } from '@/modules/morpho/components/VaultDetails';
import { VaultProductDetail } from '@/modules/morpho/components/VaultProductDetail';

/**
 * Per-vault detail page at /earn/vaults/$provider/$vaultAddress. The route's
 * beforeLoad guarantees the address belongs to a known vault of that provider
 * on *some* chain; resolution against the active chain happens here (wagmi
 * state), falling back to the Earn marketplace — the legacy vaults overview
 * this used to fall back on was retired with the /earn/fixed and /earn/rewards
 * overviews (G6).
 */
export function VaultDetailPage() {
  const chainId = useChainId();
  const { isConnectedAndAcceptedTerms } = useConnectedContext();

  const routeVaultAddress = (useRouteEntityParams().vaultAddress ?? null) as `0x${string}` | null;

  const vault = VAULTS.find(v => v.vaultAddress[chainId]?.toLowerCase() === routeVaultAddress?.toLowerCase());
  const vaultAddress = vault?.vaultAddress[chainId];

  // Known vault, but not deployed on the active chain (e.g. the network param
  // switched under the URL) — the marketplace lists what this chain offers.
  if (!vault || !vaultAddress) {
    return <Navigate to="/earn" search={keepSearch} replace />;
  }

  // Morpho vault details render on the new full-width ProductDetailTemplate (D4).
  if (vault.provider === 'morpho') {
    return <VaultProductDetail vault={vault} vaultAddress={vaultAddress} />;
  }

  // The sky (sUSDT Tether Savings, flag-gated) detail has no V2 product page yet
  // (APP-266 track), so it keeps the legacy widget + details components — but
  // stacked on the document rather than in the retired two-pane box (G5). The
  // `details-pane` class stays as the e2e pane-visibility locator hook.
  return (
    <div className="flex w-full flex-col gap-4 pb-8">
      {withErrorBoundary(<VaultsWidgetPane />)}
      <div className="details-pane bg-panel flex w-full flex-col gap-4 rounded-3xl p-3 md:p-6 xl:p-8">
        {!isConnectedAndAcceptedTerms && <ConnectCard intent={Intent.VAULTS_INTENT} />}
        <VaultDetails vaultAddress={vaultAddress} assetToken={vault.assetToken} vaultName={vault.name} />
      </div>
    </div>
  );
}
