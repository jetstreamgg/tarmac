import { CardAnimationWrapper, WidgetContainer } from '@jetstreamgg/sky-widgets';
import { SharedProps } from '@/modules/app/types/Widgets';
import { useConfigContext } from '@/modules/config/hooks/useConfigContext';
import { ExpertIntent } from '@/lib/enums';
import { Heading, Text } from '@/modules/layout/components/Typography';
import { Trans } from '@lingui/react/macro';
import { AnimatePresence } from 'framer-motion';
import { StUSDSWidgetPane } from '@/modules/stusds/components/StUSDSWidgetPane';
import { MorphoVaultWidgetPane } from '@/modules/morpho/components/MorphoVaultWidgetPane';
import { ExpertIntentMapping, QueryParams } from '@/lib/constants';
import { useSearchParams } from 'react-router-dom';
import { ExpertRiskDisclaimer } from './ExpertRiskDisclaimer';
import { StusdsStatsCard } from './StusdsStatsCard';
import { MorphoVaultStatsCard } from './MorphoVaultStatsCard';
import { MORPHO_VAULTS } from '@jetstreamgg/sky-hooks';
import { MorphoVaultBadge } from '@jetstreamgg/sky-widgets';
import { useChainId } from 'wagmi';
import { MockStatsCard } from './MockStatsCard';

export function ExpertWidgetPane(sharedProps: SharedProps) {
  const { selectedExpertOption, setSelectedExpertOption, expertRiskDisclaimerShown } = useConfigContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const chainId = useChainId();

  const selectedVaultAddress = searchParams.get(QueryParams.Vault) as `0x${string}` | null;
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

              <Text className="text-textSecondary mt-2 text-xs font-semibold uppercase tracking-wider">
                <Trans>Risk Tokens</Trans>
              </Text>
              <StusdsStatsCard
                onClick={() => handleSelectExpertOption(ExpertIntent.STUSDS_INTENT)}
                disabled={!expertRiskDisclaimerShown}
              />


              <Text className="text-textSecondary mt-2 text-xs font-semibold uppercase tracking-wider">
                <Trans>Morpho Vaults</Trans>
              </Text>
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
                    disabled={!expertRiskDisclaimerShown}
                  />
                );
              })}
              <MockStatsCard
                name="USDS Flagship Vault"
                tokenSymbol="USDS"
                badge={<MorphoVaultBadge />}
                rate="9.25%"
                stat1Label="TVL"
                stat1Value="28.3M USDS"
                stat2Label="Depositors"
                stat2Value="3,217"
                disabled={!expertRiskDisclaimerShown}
              />
              <MockStatsCard
                name="USDT Savings"
                tokenSymbol="USDT"
                badge={<MorphoVaultBadge />}
                rate="7.80%"
                stat1Label="TVL"
                stat1Value="15.1M USDT"
                stat2Label="Depositors"
                stat2Value="2,456"
                disabled={!expertRiskDisclaimerShown}
              />
            </CardAnimationWrapper>
          </WidgetContainer>
        )}
      </CardAnimationWrapper>
    </AnimatePresence>
  );
}
