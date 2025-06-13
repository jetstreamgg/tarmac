import { t } from '@lingui/core/macro';
import { DetailSection } from '@/modules/ui/components/DetailSection';
import { DetailSectionRow } from '@/modules/ui/components/DetailSectionRow';
import { DetailSectionWrapper } from '@/modules/ui/components/DetailSectionWrapper';
import { ActionsShowcase } from '@/modules/ui/components/ActionsShowcase';
import { useConnectedContext } from '@/modules/ui/context/ConnectedContext';
import { IntentMapping } from '@/lib/constants';
import { useConfigContext } from '@/modules/config/hooks/useConfigContext';
import { RewardsFaq } from './RewardsFaq';
import { RewardsOverviewCharts } from './history/RewardsOverviewCharts';
import { RewardsOverviewInfo } from './RewardsOverviewInfo';
import { useAvailableTokenRewardContracts } from '@jetstreamgg/sky-hooks';
import { useUserSuggestedActions } from '@/modules/ui/hooks/useUserSuggestedActions';
import { RewardsOverviewAbout } from './RewardsOverviewAbout';
import { filterActionsByIntent } from '@/lib/utils';

export function RewardsOverview() {
  const { isConnectedAndAcceptedTerms } = useConnectedContext();
  const { linkedActionConfig } = useConfigContext();
  const { data: actionData } = useUserSuggestedActions();
  const widget = IntentMapping.REWARDS_INTENT;
  const allRewardContracts = useAvailableTokenRewardContracts(1); //hardcode to mainnet for now to avoid bugs when linking to mainnet rewards from another chain. Should maybe update to read from query params

  return (
    <DetailSectionWrapper>
      <DetailSection title={t`Sky Token Rewards overview`}>
        <DetailSectionRow>
          <RewardsOverviewInfo />
        </DetailSectionRow>
      </DetailSection>
      {isConnectedAndAcceptedTerms &&
        !linkedActionConfig?.showLinkedAction &&
        (filterActionsByIntent(actionData?.linkedActions || [], widget).length ?? 0) > 0 && (
          <DetailSection title={t`Combined actions`}>
            <DetailSectionRow>
              <ActionsShowcase widget={widget} />
            </DetailSectionRow>
          </DetailSection>
        )}
      <DetailSection title={t`Sky Token Rewards activity`}>
        <DetailSectionRow>
          <RewardsOverviewCharts rewardContracts={allRewardContracts} />
        </DetailSectionRow>
      </DetailSection>
      <DetailSection title={t`About Native Sky Protocol Tokens`}>
        <DetailSectionRow>
          <RewardsOverviewAbout />
        </DetailSectionRow>
      </DetailSection>
      <DetailSection title={t`FAQs`}>
        <DetailSectionRow>
          <RewardsFaq />
        </DetailSectionRow>
      </DetailSection>
    </DetailSectionWrapper>
  );
}
