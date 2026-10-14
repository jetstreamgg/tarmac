import { useEffect } from 'react';
import { useChainId } from 'wagmi';
import { Navigate, useRouterState } from '@tanstack/react-router';
import { trackRouteRedirected } from '@/modules/analytics/lib/trackRouteRedirected';
import { keepSearch, useRouteEntityParams } from '@/lib/navigation';
import { VAULTS } from '@/hooks';
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
  const pathname = useRouterState({ select: s => s.location.pathname });

  const routeVaultAddress = (useRouteEntityParams().vaultAddress ?? null) as `0x${string}` | null;

  const vault = VAULTS.find(v => v.vaultAddress[chainId]?.toLowerCase() === routeVaultAddress?.toLowerCase());
  const vaultAddress = vault?.vaultAddress[chainId];

  const fallbackToMarketplace = !vault || !vaultAddress;
  useEffect(() => {
    if (fallbackToMarketplace) {
      trackRouteRedirected({ fromPath: pathname, toPath: '/earn', reason: 'unknown_vault' });
    }
  }, [fallbackToMarketplace, pathname]);

  // Known vault, but not deployed on the active chain (e.g. the network param
  // switched under the URL) — the marketplace lists what this chain offers.
  if (fallbackToMarketplace) {
    return <Navigate to="/earn" search={keepSearch} replace />;
  }

  // Vault details render on the full-width ProductDetailTemplate (D4).
  return <VaultProductDetail vault={vault} vaultAddress={vaultAddress} />;
}
