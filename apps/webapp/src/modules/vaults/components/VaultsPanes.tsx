import { useChainId } from 'wagmi';
import { Intent } from '@/lib/enums';
import { withErrorBoundary } from '@/modules/utils/withErrorBoundary';
import { TwoPane } from '@/modules/app/components/TwoPane';
import { DetailsLayout } from '@/modules/app/components/DetailsLayout';
import { useBreakpointIndex } from '@/modules/ui/hooks/useBreakpointIndex';
import { useRouteEntityParams } from '@/lib/navigation';
import { VAULTS } from '@/hooks';
import { VaultsWidgetPane } from './VaultsWidgetPane';
import { VaultsDetailsPane } from './VaultsDetailsPane';
import { VaultDetails } from '@/modules/morpho/components/VaultDetails';
import { VaultProductDetail } from '@/modules/morpho/components/VaultProductDetail';

/** Panes for the Vaults module, including the provider/vault detail route. */
export function VaultsPanes() {
  const { bpi } = useBreakpointIndex();
  const chainId = useChainId();

  // Get the selected vault address from the route (for multi-vault support)
  const selectedVaultAddress = (useRouteEntityParams().vaultAddress ?? null) as `0x${string}` | null;

  // Find the selected vault config; unresolved addresses fall back to the
  // vaults overview details instead of showing a different vault.
  const routeSelectedVault = VAULTS.find(
    v => v.vaultAddress[chainId]?.toLowerCase() === selectedVaultAddress?.toLowerCase()
  );

  // Morpho vault details render on the new full-width ProductDetailTemplate (D4).
  // The overview and Spark/sky details keep the legacy two-pane layout.
  const selectedAddress = routeSelectedVault?.vaultAddress[chainId];
  if (routeSelectedVault?.provider === 'morpho' && selectedAddress) {
    return <VaultProductDetail vault={routeSelectedVault} vaultAddress={selectedAddress} />;
  }

  return (
    <TwoPane
      // Remount per breakpoint, matching the legacy widget-pane key
      key={`vaults-${bpi}`}
      widget={withErrorBoundary(<VaultsWidgetPane />)}
      details={
        <DetailsLayout intent={Intent.VAULTS_INTENT} contentKey={routeSelectedVault ? 'detail' : 'overview'}>
          {routeSelectedVault ? (
            <VaultDetails
              vaultAddress={routeSelectedVault.vaultAddress[chainId]}
              assetToken={routeSelectedVault.assetToken}
              vaultName={routeSelectedVault.name}
            />
          ) : (
            <VaultsDetailsPane />
          )}
        </DetailsLayout>
      }
    />
  );
}
