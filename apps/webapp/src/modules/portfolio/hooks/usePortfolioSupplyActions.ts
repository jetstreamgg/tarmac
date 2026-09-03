import { useCallback } from 'react';
import { useChainId, useChains, useSwitchChain } from 'wagmi';
import {
  TOKENS,
  VAULTS,
  useAvailableTokenRewardContractsForChains,
  useIsSafeWallet,
  getPendleMarketByAddress,
  isMarketMatured
} from '@/hooks';
import { isMainnetId, isTestnetId } from '@/utils';
// Straight from the leaf modules, not the barrel: that re-exports the provider,
// which pulls the router into anything importing this hook.
import { geoModuleForIntent } from '@/modules/geo-config/moduleForIntent';
import { useGeoConfig } from '@/modules/geo-config/hooks/useGeoConfig';
import { useNetworkSwitch } from '@/modules/ui/context/NetworkSwitchContext';
import { useSavingsModal } from '@/modules/savings/hooks/useSavingsModal';
import { useStUsdsModal } from '@/modules/stusds/hooks/useStUsdsModal';
import { useVaultModal } from '@/modules/morpho/hooks/useVaultModal';
import { useRewardsModal } from '@/modules/rewards/hooks/useRewardsModal';
import { usePendleModal } from '@/modules/pendle/hooks/usePendleModal';
import { rewardContractDisplayName } from '@/modules/rewards/helpers/rewardContractDisplayName';
import { isMorphoVault } from '@/components/product/productVisuals';
import { useAppAnalytics } from '@/modules/analytics/hooks/useAppAnalytics';
import { isUserRejectedRequestError } from '@/modules/utils/isUserRejectedRequestError';
import type { SuppliedPosition } from '../helpers/suppliedView';

/**
 * The chain a position's supply modal must run on: the position's own chain
 * (one per position since APP-547). A mainnet-family target follows
 * getMainnetTargetName's rule: when the active config carries a Tenderly fork
 * (dev/staging builds), the fork is the target — auto-switching a dev wallet
 * onto real Ethereum would mean real fees.
 */
function supplyChainFor(
  position: SuppliedPosition,
  connectedChainId: number,
  chains: readonly { id: number }[]
): number {
  const target = position.chainId;
  if (target === connectedChainId) return connectedChainId;
  if (isMainnetId(target)) {
    const fork = chains.find(c => isTestnetId(c.id));
    if (fork) return fork.id;
  }
  return target;
}

/**
 * Resolves a supplied position to its in-place "Supply" handler — the modal a
 * product opens without leaving the Portfolio page — or `undefined` when the
 * product has none, or when its module is geo-restricted (the caller then
 * navigates to its product page; for a restricted module the route guard
 * enforces the restriction there — an in-place modal would bypass it, APP-484).
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
 * the button remains clickable. Safe wallets are the exception: they can never
 * switch from the dapp, so a cross-chain position resolves to `undefined` and
 * the caller navigates to the product page instead, where the network
 * selector renders as a static pill for a Safe — its chain is fixed by the
 * Safe app it runs inside (APP-486).
 */
export function usePortfolioSupplyActions(): (position: SuppliedPosition) => (() => void) | undefined {
  const connectedChainId = useChainId();
  const chains = useChains();
  const { isModuleEnabled } = useGeoConfig();
  const { switchChainAsync } = useSwitchChain();
  const isSafeWallet = useIsSafeWallet();
  const { setIsAutoSwitching, setAutoSwitchIntent } = useNetworkSwitch();
  const { trackNetworkSwitchRequested, trackNetworkSwitchCompleted } = useAppAnalytics();
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
      const geoModuleId = geoModuleForIntent(position.intent);
      // While the geo config loads, isModuleEnabled answers false for every
      // module — deliberately fail-closed here (the fallback just navigates),
      // unlike the display hooks, which fail open to avoid blanking the page.
      if (geoModuleId && !isModuleEnabled(geoModuleId)) return undefined;

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
                productName: contract.name,
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

      // A Safe can't switch networks from the dapp, so the auto-switch below
      // would fail on every click — a permanently dead button (APP-486).
      if (isSafeWallet) return undefined;

      // Wrong chain: move the wallet to the position's chain first. The auto
      // flags make the shell toast explain the change with the owning module's
      // copy instead of the generic "network changed" line.
      return async () => {
        setAutoSwitchIntent(position.intent);
        setIsAutoSwitching(true);
        trackNetworkSwitchRequested({
          source: 'portfolio_supply',
          fromChainId: connectedChainId,
          toChainId: requiredChainId
        });
        try {
          await switchChainAsync({ chainId: requiredChainId });
        } catch (error) {
          // Rejected or failed — open nothing; the click stays retryable.
          // Recorded: this silent dead-end was invisible (APP-444 D-2).
          trackNetworkSwitchCompleted({
            source: 'portfolio_supply',
            fromChainId: connectedChainId,
            toChainId: requiredChainId,
            status: isUserRejectedRequestError(error) ? 'rejected' : 'error'
          });
          setIsAutoSwitching(false);
          setAutoSwitchIntent(null);
          return;
        }
        trackNetworkSwitchCompleted({
          source: 'portfolio_supply',
          fromChainId: connectedChainId,
          toChainId: requiredChainId,
          status: 'success'
        });
        open();
      };
    },
    [
      connectedChainId,
      chains,
      isModuleEnabled,
      switchChainAsync,
      isSafeWallet,
      setIsAutoSwitching,
      setAutoSwitchIntent,
      openSavingsSupply,
      openVaultSupply,
      openRewardsSupply,
      rewardContractsFor,
      openStUsdsSupply,
      openPendleSupply,
      trackNetworkSwitchRequested,
      trackNetworkSwitchCompleted
    ]
  );
}
