import { CardAnimationWrapper, WidgetContainer } from '@/widgets';
import { useConfigContext } from '@/modules/config/hooks/useConfigContext';
import { ExpertIntent } from '@/lib/enums';
import { Heading, Text } from '@/modules/layout/components/Typography';
import { Trans } from '@lingui/react/macro';
import { AnimatePresence } from 'motion/react';
import { StUSDSWidgetPane } from '@/modules/stusds/components/StUSDSWidgetPane';
import { EXPERT_WIDGET_OPTIONS, ExpertIntentMapping } from '@/lib/constants';
import { useNavigate } from '@tanstack/react-router';
import { keepSearch, useRouteExpertIntent } from '@/lib/navigation';
import { ExpertRiskDisclaimer } from './ExpertRiskDisclaimer';
import { StusdsStatsCard } from './StusdsStatsCard';

export function ExpertWidgetPane() {
  const { expertRiskDisclaimerShown } = useConfigContext();
  const routeExpertIntent = useRouteExpertIntent();
  const navigate = useNavigate();

  // Submodules only render once the risk disclaimer has been acknowledged;
  // until then (the orchestration redirect is in flight) the overview shows.
  const selectedExpertOption = expertRiskDisclaimerShown ? routeExpertIntent : undefined;

  const handleSelectExpertOption = (expertIntent: ExpertIntent) => {
    void navigate({ to: `/expert/${ExpertIntentMapping[expertIntent]}`, search: keepSearch });
  };

  const renderSelectedWidget = () => {
    switch (selectedExpertOption) {
      case ExpertIntent.STUSDS_INTENT:
        return <StUSDSWidgetPane />;
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
