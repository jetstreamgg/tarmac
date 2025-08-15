import { CardAnimationWrapper, WidgetContainer } from '@jetstreamgg/sky-widgets';
import { SharedProps } from '@/modules/app/types/Widgets';
import { useConfigContext } from '@/modules/config/hooks/useConfigContext';
import { ExpertIntent } from '@/lib/enums';
import { Heading, Text } from '@/modules/layout/components/Typography';
import { Trans } from '@lingui/react/macro';
import { AnimatePresence } from 'framer-motion';
import { StUSDSWidgetPane } from '@/modules/stusds/components/StUSDSWidgetPane';
import { EXPERT_WIDGET_OPTIONS, ExpertIntentMapping, QueryParams } from '@/lib/constants';
import { useSearchParams } from 'react-router-dom';
import { ExpertRiskDisclaimer } from './ExpertRiskDisclaimer';
import { StusdsStatsCard } from './StusdsStatsCard';

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

  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <CardAnimationWrapper key={selectedExpertOption} className="h-full">
        {selectedExpertOption === ExpertIntent.STUSDS_INTENT ? (
          <StUSDSWidgetPane {...sharedProps} />
        ) : (
          <WidgetContainer
            header={
              <div className="space-y-1">
                <Heading variant="x-large">
                  <Trans>Expert Modules</Trans>
                </Heading>
                <Text className="text-textSecondary" variant="small">
                  <Trans>Higher-Risk Options: For experienced users</Trans>
                </Text>
              </div>
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
                  // Add more cases here for future contracts
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
