import { useCallback } from 'react';
import { useChainId, useChains, useSwitchChain } from 'wagmi';
import {
  TOKENS,
  VAULTS,
  useAvailableTokenRewardContractsForChains,
  getPendleMarketByAddress,
  isMarketMatured
} from '@/hooks';
import { isMainnetId, isTestnetId } from '@/utils';
import { useNetworkSwitch } from '@/modules/ui/context/NetworkSwitchContext';
import { useSavingsModal } from '@/modules/savings/hooks/useSavingsModal';
import { useStUsdsModal } from '@/modules/stusds/hooks/useStUsdsModal';
import { useVaultModal } from '@/modules/morpho/hooks/useVaultModal';
import { useRewardsModal } from '@/modules/rewards/hooks/useRewardsModal';
import { usePendleModal } from '@/modules/pendle/hooks/usePendleModal';
import { rewardContractDisplayName } from '@/modules/rewards/helpers/rewardContractDisplayName';
import { isMorphoVault } from '@/components/product/productVisuals';
import type { SuppliedPosition } from '../helpers/suppliedView';

/**
 * The chain a position's supply modal must run on: the connected chain when
 * the position lives there, otherwise the position's own chain (preferring the
 * mainnet-family entry when a position spans several). A mainnet-family target
 * follows getMainnetTargetName's rule: when the active config carries a
 * Tenderly fork (dev/staging builds), the fork is the target — auto-switching
 * a dev wallet onto real Ethereum would mean real fees.
 */
function supplyChainFor(
  position: SuppliedPosition,
  connectedChainId: number,
  chains: readonly { id: number }[]
): number {
  if (position.chainIds.includes(connectedChainId)) return connectedChainId;
  const target = position.chainIds.find(isMainnetId) ?? position.chainIds[0] ?? connectedChainId;
  if (isMainnetId(target)) {
    const fork = chains.find(c => isTestnetId(c.id));
    if (fork) return fork.id;
  }
  return target;
}

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
 * A position living on a chain other than the connected one still gets a
 * handler: it switches the wallet to the position's chain first (announced by
 * the shell's network toast via the auto-switch flags), then opens the modal.
 * A rejected or failed switch opens nothing — the user stays on Portfolio and
 * the button remains clickable.
 */
export function usePortfolioSupplyActions(): (position: SuppliedPosition) => (() => void) | undefined {
  const connectedChainId = useChainId();
  const chains = useChains();
  const { switchChainAsync } = useSwitchChain();
  const { setIsAutoSwitching, setAutoSwitchIntent } = useNetworkSwitch();
  const { openSupply: openSavingsSupply } = useSavingsModal();
  const { openSupply: openStUsdsSupply } = useStUsdsModal();
  const { openSupply: openVaultSupply } = useVaultModal();
  const { openSupply: openPendleSupply } = usePendleModal();
  const { openSupply: openRewardsSupply } = useRewardsModal();
  // Deprecated farms are already filtered out of the registry, so a rewards
  // position here always resolves to a supplyable contract. Chain-keyed: a
  // position's farm is looked up on the position's chain, not the wallet's.
  const rewardContractsFor = useAvailableTokenRewardContractsForChains();

  return useCallback(
    (position: SuppliedPosition) => {
      const requiredChainId = supplyChainFor(position, connectedChainId, chains);
      const onConnectedChain = requiredChainId === connectedChainId;

      const resolveOpen = (): (() => void) | undefined => {
        switch (position.kind) {
          case 'savings':
            return () => openSavingsSupply();
          case 'vault': {
            // Morpho vaults only (Spark/'sky' has no in-place modal). Resolve the
            // registry vault from the position's structured address, then open
            // against its address on the position's chain.
            if (!isMorphoVault(position) || !position.address) return undefined;
            const positionAddress = position.address.toLowerCase();
            const vault = VAULTS.find(
              v =>
                v.provider === 'morpho' &&
                Object.values(v.vaultAddress).some(address => address?.toLowerCase() === positionAddress)
            );
            const vaultAddress = vault?.vaultAddress[requiredChainId];
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
            if (!position.address) return undefined;
            const positionAddress = position.address.toLowerCase();
            const contract = rewardContractsFor(requiredChainId).find(
              c => c.contractAddress?.toLowerCase() === positionAddress
            );
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
            return () => openStUsdsSupply();
          case 'fixed': {
            // Resolve the registry market from the position's address. Matured
            // markets take no new supply — their card navigates to the overview,
            // where redemption lives (maturity gating unchanged).
            if (!position.address) return undefined;
            const market = getPendleMarketByAddress(position.address);
            if (!market || isMarketMatured(market.expiry)) return undefined;
            return () => openPendleSupply(market);
          }
          default:
            return undefined;
        }
      };

      const open = resolveOpen();
      if (!open) return undefined;
      if (onConnectedChain) return open;

      // Wrong chain: move the wallet to the position's chain first. The auto
      // flags make the shell toast explain the change with the owning module's
      // copy instead of the generic "network changed" line.
      return async () => {
        setAutoSwitchIntent(position.intent);
        setIsAutoSwitching(true);
        try {
          await switchChainAsync({ chainId: requiredChainId });
        } catch {
          // Rejected or failed — open nothing; the click stays retryable.
          setIsAutoSwitching(false);
          setAutoSwitchIntent(null);
          return;
        }
        open();
      };
    },
    [
      connectedChainId,
      chains,
      switchChainAsync,
      setIsAutoSwitching,
      setAutoSwitchIntent,
      openSavingsSupply,
      openVaultSupply,
      openRewardsSupply,
      rewardContractsFor,
      openStUsdsSupply,
      openPendleSupply
    ]
  );
}
