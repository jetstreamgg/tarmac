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
import { AboutStakeModule } from '@/modules/ui/components/AboutStakeModule';
import { StakeFaq } from './StakeFaq';
import { StakePositionOverview } from './StakePositionOverview';
import { StakeHistory } from './StakeHistory';
import { StakeChart } from './StakeChart';

export function StakePositionDetails({ positionIndex }: { positionIndex?: number }): React.ReactElement {
  const { isConnectedAndAcceptedTerms } = useConnectedContext();
  const { linkedActionConfig } = useConfigContext();
  const { data: actionData } = useUserSuggestedActions();
  const widget = IntentMapping.STAKE_INTENT;
  return (
    <DetailSectionWrapper>
      {positionIndex !== undefined && <StakePositionOverview positionIndex={positionIndex} />}
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
          <StakeChart />
        </DetailSectionRow>
      </DetailSection>
      <DetailSection title={t`About Staking Rewards`}>
        <DetailSectionRow>
          <AboutStakeModule />
        </DetailSectionRow>
      </DetailSection>
      {isConnectedAndAcceptedTerms && (
        <DetailSection title={t`Your Staking position transaction history`}>
          <DetailSectionRow>
            <StakeHistory index={positionIndex} />
          </DetailSectionRow>
        </DetailSection>
      )}
      <DetailSection title={t`FAQs`}>
        <DetailSectionRow>
          <StakeFaq />
        </DetailSectionRow>
      </DetailSection>
    </DetailSectionWrapper>
  );
}
