import { DetailSection } from '@/modules/ui/components/DetailSection';
import { DetailSectionRow } from '@/modules/ui/components/DetailSectionRow';
import { DetailSectionWrapper } from '@/modules/ui/components/DetailSectionWrapper';
import { t } from '@lingui/core/macro';
import { RewardsTokenInfo } from './RewardsTokenInfo';
import { RewardsCharts } from './history/RewardsCharts';
import { RewardContract, TOKENS } from '@jetstreamgg/sky-hooks';
import { RewardsBalanceDetails } from './RewardsBalanceDetails';
import { RewardsHistory } from './RewardsHistory';
import { RewardsFaq } from './RewardsFaq';
import { ActionsShowcase } from '@/modules/ui/components/ActionsShowcase';
import { useConnectedContext } from '@/modules/ui/context/ConnectedContext';
import { IntentMapping } from '@/lib/constants';
import { useConfigContext } from '@/modules/config/hooks/useConfigContext';
import { AboutCle } from '@/modules/ui/components/AboutCle';
import { useUserSuggestedActions } from '@/modules/ui/hooks/useUserSuggestedActions';
import { RewardsOverviewAbout } from './RewardsOverviewAbout';
import { filterActionsByIntent } from '@/lib/utils';

export function RewardsDetailsView({ rewardContract }: { rewardContract?: RewardContract }) {
  const { isConnectedAndAcceptedTerms } = useConnectedContext();
  const { linkedActionConfig } = useConfigContext();
  const { data: actionData } = useUserSuggestedActions();
  if (!rewardContract) {
    return null;
  }
  const widget = IntentMapping.REWARDS_INTENT;

  return (
    <DetailSectionWrapper>
      <DetailSection title={t`Your Rewards balances`}>
        <DetailSectionRow>
          <RewardsBalanceDetails rewardContract={rewardContract} />
        </DetailSectionRow>
      </DetailSection>
      <DetailSection title={t`${rewardContract.name} — Rewards statistics`}>
        <DetailSectionRow>
          <RewardsTokenInfo rewardContract={rewardContract} />
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
      {isConnectedAndAcceptedTerms && (
        <DetailSection title={t`Your Rewards transaction history`}>
          <DetailSectionRow>
            <RewardsHistory rewardContract={rewardContract} />
          </DetailSectionRow>
        </DetailSection>
      )}
      <DetailSection title={t`Metrics`}>
        <DetailSectionRow>
          <RewardsCharts rewardContract={rewardContract} />
        </DetailSectionRow>
      </DetailSection>
      {rewardContract.rewardToken.symbol === TOKENS.sky.symbol && (
        <DetailSection title={t`About Native Sky Protocol Tokens`}>
          <DetailSectionRow>
            <RewardsOverviewAbout />
          </DetailSectionRow>
        </DetailSection>
      )}
      {rewardContract.rewardToken.symbol === TOKENS.cle.symbol && (
        <DetailSection title={t`About Chronicle points`}>
          <DetailSectionRow>
            <AboutCle />
          </DetailSectionRow>
        </DetailSection>
      )}
      <DetailSection title={t`FAQs`}>
        <DetailSectionRow>
          <RewardsFaq rewardContract={rewardContract} />
        </DetailSectionRow>
      </DetailSection>
    </DetailSectionWrapper>
  );
}
