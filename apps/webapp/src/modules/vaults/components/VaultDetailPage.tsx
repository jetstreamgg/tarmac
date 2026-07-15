import { useChainId } from 'wagmi';
import { Navigate } from '@tanstack/react-router';
import { Intent } from '@/lib/enums';
import { withErrorBoundary } from '@/modules/utils/withErrorBoundary';
import { TwoPane } from '@/modules/app/components/TwoPane';
import { DetailsLayout } from '@/modules/app/components/DetailsLayout';
import { useBreakpointIndex } from '@/hooks';
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
  const { bpi } = useBreakpointIndex();
  const chainId = useChainId();

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

  // The sky (sUSDT Tether Savings, flag-gated) detail still renders the legacy
  // two-pane layout pending its V2 product page (APP-266 track).
  return (
    <TwoPane
      // Remount per breakpoint, matching the legacy widget-pane key
      key={`vaults-${bpi}`}
      widget={withErrorBoundary(<VaultsWidgetPane />)}
      details={
        <DetailsLayout intent={Intent.VAULTS_INTENT} contentKey="detail">
          <VaultDetails vaultAddress={vaultAddress} assetToken={vault.assetToken} vaultName={vault.name} />
        </DetailsLayout>
      }
    />
  );
}
