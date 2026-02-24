import { CardAnimationWrapper, WidgetContainer } from '@jetstreamgg/sky-widgets';
import { SharedProps } from '@/modules/app/types/Widgets';
import { useConfigContext } from '@/modules/config/hooks/useConfigContext';
import { VaultsIntent } from '@/lib/enums';
import { Heading, Text } from '@/modules/layout/components/Typography';
import { Trans } from '@lingui/react/macro';
import { AnimatePresence } from 'framer-motion';
import { MorphoVaultWidgetPane } from '@/modules/morpho/components/MorphoVaultWidgetPane';
import { VaultsIntentMapping, QueryParams } from '@/lib/constants';
import { useSearchParams } from 'react-router-dom';
import { MorphoVaultStatsCard } from '@/modules/expert/components/MorphoVaultStatsCard';
import { MORPHO_VAULTS } from '@jetstreamgg/sky-hooks';
import { useChainId } from 'wagmi';

export function VaultsWidgetPane(sharedProps: SharedProps) {
  const { selectedVaultsOption, setSelectedVaultsOption } = useConfigContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const chainId = useChainId();

  const selectedVaultAddress = searchParams.get(QueryParams.Vault) as `0x${string}` | null;

  const selectedVault =
    MORPHO_VAULTS.find(v => v.vaultAddress[chainId]?.toLowerCase() === selectedVaultAddress?.toLowerCase()) ||
    MORPHO_VAULTS[0];

  // Derive effective option from URL param so deep-links and quick access work
  const effectiveVaultsOption = selectedVaultAddress
    ? VaultsIntent.MORPHO_VAULT_INTENT
    : selectedVaultsOption;

  const handleSelectMorphoVault = (vaultAddress: `0x${string}`) => {
    setSearchParams(params => {
      params.set(QueryParams.VaultModule, VaultsIntentMapping[VaultsIntent.MORPHO_VAULT_INTENT]);
      params.set(QueryParams.Vault, vaultAddress);
      return params;
    });
    setSelectedVaultsOption(VaultsIntent.MORPHO_VAULT_INTENT);
  };

  const renderSelectedWidget = () => {
    switch (effectiveVaultsOption) {
      case VaultsIntent.MORPHO_VAULT_INTENT:
        return (
          <MorphoVaultWidgetPane
            {...sharedProps}
            vaultAddress={selectedVault.vaultAddress}
            assetToken={selectedVault.assetToken}
            vaultName={selectedVault.name}
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
                <Trans>Third-party vault integrations with Sky ecosystem tokens</Trans>
              </Text>
            }
            rightHeader={sharedProps.rightHeaderComponent}
          >
            <CardAnimationWrapper className="flex flex-col gap-4">
              {MORPHO_VAULTS.map(vault => {
                const vaultAddressForChain = vault.vaultAddress[chainId];
                if (!vaultAddressForChain) return null;
                return (
                  <MorphoVaultStatsCard
                    key={vaultAddressForChain}
                    vaultAddress={vault.vaultAddress}
                    vaultName={vault.name}
                    assetToken={vault.assetToken}
                    onClick={() => handleSelectMorphoVault(vaultAddressForChain)}
                  />
                );
              })}
            </CardAnimationWrapper>
          </WidgetContainer>
        )}
      </CardAnimationWrapper>
    </AnimatePresence>
  );
}
