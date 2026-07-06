import { useCallback } from 'react';
import { useChainId } from 'wagmi';
import {
  TOKENS,
  VAULTS,
  useAvailableTokenRewardContracts,
  getPendleMarketByAddress,
  isMarketMatured
} from '@/hooks';
import { useSavingsModal } from '@/modules/savings/hooks/useSavingsModal';
import { useStUsdsModal } from '@/modules/stusds/hooks/useStUsdsModal';
import { useVaultModal } from '@/modules/morpho/hooks/useVaultModal';
import { useRewardsModal } from '@/modules/rewards/hooks/useRewardsModal';
import { usePendleModal } from '@/modules/pendle/hooks/usePendleModal';
import { rewardContractDisplayName } from '@/modules/rewards/helpers/rewardContractDisplayName';
import { isMorphoVault } from '@/components/product/productVisuals';
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
  const { openSupply: openStUsdsSupply } = useStUsdsModal();
  const { openSupply: openVaultSupply } = useVaultModal();
  const { openSupply: openPendleSupply } = usePendleModal();
  const { openSupply: openRewardsSupply } = useRewardsModal();
  // Deprecated farms are already filtered out of the registry, so a rewards
  // position here always resolves to a supplyable contract.
  const rewardContracts = useAvailableTokenRewardContracts(connectedChainId);

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
        case 'rewards': {
          // Resolve the registry farm from the position's structured address,
          // then open the shared rewards supply modal against it (D6).
          if (!onConnectedChain || !position.address) return undefined;
          const positionAddress = position.address.toLowerCase();
          const contract = rewardContracts.find(c => c.contractAddress?.toLowerCase() === positionAddress);
          if (!contract) return undefined;
          return () =>
            openRewardsSupply({
              contractAddress: contract.contractAddress as `0x${string}`,
              supplyToken: contract.supplyToken,
              displayName: rewardContractDisplayName(contract),
              rewardTokenSymbol:
                contract.rewardToken.symbol === TOKENS.cle.symbol ? undefined : contract.rewardToken.symbol,
              rate: position.rate
            });
        }
        case 'stusds':
          // Singleton product, mainnet-family only — no call-time args needed.
          return onConnectedChain ? () => openStUsdsSupply() : undefined;
        case 'fixed': {
          // Resolve the registry market from the position's address. Matured
          // markets take no new supply — their card navigates to the overview,
          // where redemption lives (maturity gating unchanged).
          if (!onConnectedChain || !position.address) return undefined;
          const market = getPendleMarketByAddress(position.address);
          if (!market || isMarketMatured(market.expiry)) return undefined;
          return () => openPendleSupply(market);
        }
        default:
          return undefined;
      }
    },
    [
      connectedChainId,
      openSavingsSupply,
      openVaultSupply,
      openRewardsSupply,
      rewardContracts,
      openStUsdsSupply,
      openPendleSupply
    ]
  );
}
