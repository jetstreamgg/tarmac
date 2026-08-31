import { CardAnimationWrapper, WidgetContainer } from '@/widgets';
import { VaultsIntent } from '@/lib/enums';
import { Heading, Text } from '@/modules/layout/components/Typography';
import { Trans } from '@lingui/react/macro';
import { AnimatePresence, motion } from 'motion/react';
import { MorphoVaultWidgetPane } from '@/modules/morpho/components/MorphoVaultWidgetPane';
import { vaultModuleForProvider } from '@/lib/vaults/vaultProviderMapping';
import { VaultProvider } from '@/hooks/vaults/types';
import { useNavigate } from '@tanstack/react-router';
import { keepSearch, useRouteEntityParams } from '@/lib/navigation';
import { VaultStatsCard } from './VaultStatsCard';
import { VAULTS, useAllMorphoVaultsUserAssets } from '@/hooks';
import { useChainId } from 'wagmi';
import { useMemo } from 'react';
import { positionAnimations } from '@/widgets';

export function VaultsWidgetPane() {
  const navigate = useNavigate();
  const chainId = useChainId();

  const selectedVaultAddress = (useRouteEntityParams().vaultAddress ?? null) as `0x${string}` | null;

  const routeSelectedVault = VAULTS.find(
    v => v.vaultAddress[chainId]?.toLowerCase() === selectedVaultAddress?.toLowerCase()
  );
  const selectedVault = routeSelectedVault ?? VAULTS[0];

  const { data: userVaultsData } = useAllMorphoVaultsUserAssets();

  // Separate vaults into "My Vaults" (user has balance) and "All Vaults"
  const [myVaults, allVaults] = useMemo(() => {
    const myVaults: typeof VAULTS = [];
    const allVaults: typeof VAULTS = [];

    VAULTS.forEach(vault => {
      const vaultAddressForChain = vault.vaultAddress[chainId];
      if (!vaultAddressForChain) return;

      const userVaultBalance = userVaultsData?.vaults.find(
        v => v.vaultAddress?.toLowerCase() === vaultAddressForChain.toLowerCase()
      );

      if (userVaultBalance && userVaultBalance.balance > 0n) {
        myVaults.push(vault);
      } else {
        allVaults.push(vault);
      }
    });

    return [myVaults, allVaults];
  }, [userVaultsData, chainId]);

  // Derive effective option from the route so deep-links and quick access work.
  // Detail mode requires the route's vault address to resolve on the current
  // chain — an unresolved address falls back to the overview instead of
  // opening a different vault than the URL indicates.
  const effectiveVaultsOption =
    selectedVaultAddress && routeSelectedVault ? VaultsIntent.MORPHO_VAULT_INTENT : undefined;

  // Derive the URL/routing identity from the selected vault's provider so the
  // path reflects the vault the user opened.
  const handleSelectVault = (vaultAddress: `0x${string}`, provider: VaultProvider) => {
    void navigate({
      to: '/earn/vaults/$provider/$vaultAddress',
      params: { provider: vaultModuleForProvider(provider), vaultAddress },
      search: keepSearch
    });
  };

  const renderSelectedWidget = () => {
    switch (effectiveVaultsOption) {
      case VaultsIntent.MORPHO_VAULT_INTENT:
        return (
          <MorphoVaultWidgetPane
            vaultAddress={selectedVault.vaultAddress}
            assetToken={selectedVault.assetToken}
            vaultName={selectedVault.name}
            provider={selectedVault.provider}
          />
        );
      default:
        return null;
    }
  };

  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <CardAnimationWrapper key={effectiveVaultsOption} className="h-full">
        {effectiveVaultsOption ? (
          renderSelectedWidget()
        ) : (
          <WidgetContainer
            header={
              <Heading variant="x-large">
                <Trans>Vaults</Trans>
              </Heading>
            }
            subHeader={
              <Text className="text-textSecondary" variant="small">
                <Trans>Third-party vault integrations with Sky Protocol tokens</Trans>
              </Text>
            }
          >
            <div className="flex flex-col gap-4">
              {myVaults.length > 0 && (
                <motion.div className="space-y-3" variants={positionAnimations}>
                  <Heading tag="h3" variant="medium">
                    <Trans>My vaults</Trans>
                  </Heading>
                  {myVaults.map(vault => {
                    const vaultAddressForChain = vault.vaultAddress[chainId];
                    if (!vaultAddressForChain) return null;
                    return (
                      <VaultStatsCard
                        key={vaultAddressForChain}
                        vaultAddress={vault.vaultAddress}
                        vaultName={vault.name}
                        assetToken={vault.assetToken}
                        provider={vault.provider}
                        onClick={() => handleSelectVault(vaultAddressForChain, vault.provider)}
                      />
                    );
                  })}
                </motion.div>
              )}
              {allVaults.length > 0 && (
                <motion.div className="space-y-3" variants={positionAnimations}>
                  <Heading tag="h3" variant="medium">
                    <Trans>All vaults</Trans>
                  </Heading>
                  {allVaults.map(vault => {
                    const vaultAddressForChain = vault.vaultAddress[chainId];
                    if (!vaultAddressForChain) return null;
                    return (
                      <VaultStatsCard
                        key={vaultAddressForChain}
                        vaultAddress={vault.vaultAddress}
                        vaultName={vault.name}
                        assetToken={vault.assetToken}
                        provider={vault.provider}
                        onClick={() => handleSelectVault(vaultAddressForChain, vault.provider)}
                      />
                    );
                  })}
                </motion.div>
              )}
            </div>
          </WidgetContainer>
        )}
      </CardAnimationWrapper>
    </AnimatePresence>
  );
}
