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
import { steakhousePrimeInstantVaultAddress, TOKENS } from '@jetstreamgg/sky-hooks';

export function ExpertWidgetPane(sharedProps: SharedProps) {
  const { selectedExpertOption, setSelectedExpertOption, expertRiskDisclaimerShown } = useConfigContext();
  const [, setSearchParams] = useSearchParams();

  const handleSelectExpertOption = (expertIntent: ExpertIntent) => {
    setSearchParams(params => {
      params.set(QueryParams.ExpertModule, ExpertIntentMapping[expertIntent]);
      return params;
    });
    setSelectedExpertOption(expertIntent);
  };

  const renderSelectedWidget = () => {
    switch (selectedExpertOption) {
      case ExpertIntent.STUSDS_INTENT:
        return <StUSDSWidgetPane {...sharedProps} />;
      case ExpertIntent.MORPHO_VAULT_INTENT:
        return (
          <MorphoVaultWidgetPane
            {...sharedProps}
            vaultAddress={steakhousePrimeInstantVaultAddress}
            assetToken={TOKENS.usdc}
            vaultName="Steakhouse Prime Instant"
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
                    return (
                      <MorphoVaultStatsCard
                        key={widget.id}
                        vaultAddress={steakhousePrimeInstantVaultAddress}
                        vaultName="Steakhouse Prime Instant"
                        assetToken={TOKENS.usdc}
                        onClick={() => handleSelectExpertOption(widget.id)}
                        disabled={!expertRiskDisclaimerShown}
                      />
                    );
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
