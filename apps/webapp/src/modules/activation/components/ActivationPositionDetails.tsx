import { t } from '@lingui/core/macro';
import { DetailSectionWrapper } from '@/modules/ui/components/DetailSectionWrapper';
import { DetailSection } from '@/modules/ui/components/DetailSection';
import { DetailSectionRow } from '@/modules/ui/components/DetailSectionRow';
import { ActionsShowcase } from '@/modules/ui/components/ActionsShowcase';
import { useConnectedContext } from '@/modules/ui/context/ConnectedContext';
import { IntentMapping } from '@/lib/constants';
import { useConfigContext } from '@/modules/config/hooks/useConfigContext';
import { useUserSuggestedActions } from '@/modules/ui/hooks/useUserSuggestedActions';
import { filterActionsByIntent } from '@/lib/utils';
import { AboutSealModule } from '@/modules/ui/components/AboutSealModule';
import { ActivationFaq } from './ActivationFaq';
import { ActivationPositionOverview } from './ActivationPositionOverview';
import { ActivationHistory } from './ActivationHistory';
import { ActivationChart } from './ActivationChart';

export function ActivationPositionDetails({ positionIndex }: { positionIndex?: number }): React.ReactElement {
  const { isConnectedAndAcceptedTerms } = useConnectedContext();
  const { linkedActionConfig } = useConfigContext();
  const { data: actionData } = useUserSuggestedActions();
  const widget = IntentMapping.ACTIVATION_INTENT;
  return (
    <DetailSectionWrapper>
      {positionIndex !== undefined && <ActivationPositionOverview positionIndex={positionIndex} />}
      {isConnectedAndAcceptedTerms &&
        !linkedActionConfig?.showLinkedAction &&
        (filterActionsByIntent(actionData?.linkedActions || [], widget).length ?? 0) > 0 && (
          <DetailSection title={t`Combined actions`}>
            <DetailSectionRow>
              <ActionsShowcase widget={widget} />
            </DetailSectionRow>
          </DetailSection>
        )}
      <DetailSection title={t`Metrics`}>
        <DetailSectionRow>
          <ActivationChart />
        </DetailSectionRow>
      </DetailSection>
      <DetailSection title={t`About Activation Rewards`}>
        <DetailSectionRow>
          <AboutSealModule />
        </DetailSectionRow>
      </DetailSection>
      {isConnectedAndAcceptedTerms && (
        <DetailSection title={t`Your Seal position transaction history`}>
          <DetailSectionRow>
            <ActivationHistory index={positionIndex} />
          </DetailSectionRow>
        </DetailSection>
      )}
      <DetailSection title={t`FAQs`}>
        <DetailSectionRow>
          <ActivationFaq />
        </DetailSectionRow>
      </DetailSection>
    </DetailSectionWrapper>
  );
}
