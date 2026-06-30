import { useCallback } from 'react';
import { useChainId } from 'wagmi';
import { VAULTS } from '@/hooks';
import { useSavingsModal } from '@/modules/savings/hooks/useSavingsModal';
import { useVaultModal } from '@/modules/morpho/hooks/useVaultModal';
import { isMorphoVault } from '../helpers/productVisuals';
import type { SuppliedPosition } from '../helpers/suppliedView';

/**
 * Resolves a supplied position to its in-place "Supply" handler — the modal a
 * product opens without leaving the Portfolio page — or `undefined` when the
 * product has none (the caller then navigates to its product page).
 *
 * Product families are wired once here, so the position card stays declarative:
 * integrating a new in-place supply is a single case in this resolver, never a
 * branch in the carousel JSX. Hooks can't be dispatched dynamically, so each
 * family's trigger hook is called unconditionally above and matched by `kind`.
 *
 * In-place modals supply on the wallet's connected chain, so a family only opens
 * one when the card's position lives on that chain; otherwise we return undefined
 * and the caller navigates to the product page, which owns the cross-chain case.
 */
export function usePortfolioSupplyActions(): (position: SuppliedPosition) => (() => void) | undefined {
  const connectedChainId = useChainId();
  const { openSupply: openSavingsSupply } = useSavingsModal();
  const { openSupply: openVaultSupply } = useVaultModal();

  return useCallback(
    (position: SuppliedPosition) => {
      const onConnectedChain = position.chainIds.includes(connectedChainId);
      switch (position.kind) {
        case 'savings':
          return onConnectedChain ? () => openSavingsSupply() : undefined;
        case 'vault': {
          // Morpho vaults only (Spark/'sky' has no in-place modal). Resolve the
          // registry vault from the position's structured address, then open
          // against its address on the connected chain.
          if (!onConnectedChain || !isMorphoVault(position) || !position.address) return undefined;
          const positionAddress = position.address.toLowerCase();
          const vault = VAULTS.find(
            v =>
              v.provider === 'morpho' &&
              Object.values(v.vaultAddress).some(address => address?.toLowerCase() === positionAddress)
          );
          const vaultAddress = vault?.vaultAddress[connectedChainId];
          if (!vault || !vaultAddress) return undefined;
          return () =>
            openVaultSupply({
              vaultAddress,
              assetToken: vault.assetToken,
              vaultName: vault.name,
              netRate: position.rate
            });
        }
        // 'rewards' | 'fixed' | 'stusds' have no in-place supply modal yet — add a
        // case as each product's trigger is integrated.
        default:
          return undefined;
      }
    },
    [connectedChainId, openSavingsSupply, openVaultSupply]
  );
}
