import { CardAnimationWrapper, WidgetContainer } from '@jetstreamgg/sky-widgets';
import { SharedProps } from '@/modules/app/types/Widgets';
import { useConfigContext } from '@/modules/config/hooks/useConfigContext';
import { ExpertIntent } from '@/lib/enums';
import { Heading, Text } from '@/modules/layout/components/Typography';
import { Trans } from '@lingui/react/macro';
import { AnimatePresence } from 'framer-motion';
import { StUSDSWidgetPane } from '@/modules/stusds/components/StUSDSWidgetPane';
import { MorphoVaultWidgetPane } from '@/modules/morpho/components/MorphoVaultWidgetPane';
import { EXPERT_WIDGET_OPTIONS, ExpertIntentMapping, QueryParams } from '@/lib/constants';
import { useSearchParams } from 'react-router-dom';
import { ExpertRiskDisclaimer } from './ExpertRiskDisclaimer';
import { StusdsStatsCard } from './StusdsStatsCard';
import { MorphoVaultStatsCard } from './MorphoVaultStatsCard';
import { MORPHO_VAULTS } from '@jetstreamgg/sky-hooks';
import { useChainId } from 'wagmi';

export function ExpertWidgetPane(sharedProps: SharedProps) {
  const { selectedExpertOption, setSelectedExpertOption, expertRiskDisclaimerShown } = useConfigContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const chainId = useChainId();

  // Get the selected vault address from URL params (for multi-vault support)
  const selectedVaultAddress = searchParams.get(QueryParams.Vault) as `0x${string}` | null;

  // Find the selected vault config, default to first vault if not specified
  const selectedVault =
    MORPHO_VAULTS.find(v => v.vaultAddress[chainId]?.toLowerCase() === selectedVaultAddress?.toLowerCase()) ||
    MORPHO_VAULTS[0];

  const handleSelectExpertOption = (expertIntent: ExpertIntent) => {
    setSearchParams(params => {
      params.set(QueryParams.ExpertModule, ExpertIntentMapping[expertIntent]);
      return params;
    });
    setSelectedExpertOption(expertIntent);
  };

  const handleSelectMorphoVault = (vaultAddress: `0x${string}`) => {
    setSearchParams(params => {
      params.set(QueryParams.ExpertModule, ExpertIntentMapping[ExpertIntent.MORPHO_VAULT_INTENT]);
      params.set(QueryParams.Vault, vaultAddress);
      return params;
    });
    setSelectedExpertOption(ExpertIntent.MORPHO_VAULT_INTENT);
  };

  const renderSelectedWidget = () => {
    switch (selectedExpertOption) {
      case ExpertIntent.STUSDS_INTENT:
        return <StUSDSWidgetPane {...sharedProps} />;
      case ExpertIntent.MORPHO_VAULT_INTENT:
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
      <CardAnimationWrapper key={selectedExpertOption} className="h-full">
        {selectedExpertOption ? (
          renderSelectedWidget()
        ) : (
          <WidgetContainer
            header={
              <Heading variant="x-large">
                <Trans>Expert</Trans>
              </Heading>
            }
            subHeader={
              <Text className="text-textSecondary" variant="small">
                <Trans>Higher-risk options for more experienced users</Trans>
              </Text>
            }
            rightHeader={sharedProps.rightHeaderComponent}
          >
            <CardAnimationWrapper className="flex flex-col gap-4">
              <ExpertRiskDisclaimer />
              {EXPERT_WIDGET_OPTIONS.map(widget => {
                switch (widget.id) {
                  case ExpertIntent.STUSDS_INTENT:
                    return (
                      <StusdsStatsCard
                        key={widget.id}
                        onClick={() => handleSelectExpertOption(widget.id)}
                        disabled={!expertRiskDisclaimerShown}
                      />
                    );
                  case ExpertIntent.MORPHO_VAULT_INTENT:
                    // Render a card for each Morpho vault
                    return MORPHO_VAULTS.map(vault => {
                      const vaultAddressForChain = vault.vaultAddress[chainId];
                      if (!vaultAddressForChain) return null;
                      return (
                        <MorphoVaultStatsCard
                          key={vaultAddressForChain}
                          vaultAddress={vault.vaultAddress}
                          vaultName={vault.name}
                          assetToken={vault.assetToken}
                          onClick={() => handleSelectMorphoVault(vaultAddressForChain)}
                          disabled={!expertRiskDisclaimerShown}
                        />
                      );
                    });
                  default:
                    return null;
                }
              })}
            </CardAnimationWrapper>
          </WidgetContainer>
        )}
      </CardAnimationWrapper>
    </AnimatePresence>
  );
}
