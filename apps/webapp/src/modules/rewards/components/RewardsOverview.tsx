import { t } from '@lingui/core/macro';
import { DetailSection } from '@/modules/ui/components/DetailSection';
import { DetailSectionRow } from '@/modules/ui/components/DetailSectionRow';
import { DetailSectionWrapper } from '@/modules/ui/components/DetailSectionWrapper';
import { RewardsFaq } from './RewardsFaq';
import { RewardsOverviewCharts } from './history/RewardsOverviewCharts';
import { RewardsOverviewInfo } from './RewardsOverviewInfo';
import { useAvailableTokenRewardContracts } from '@/hooks';
import { RewardsOverviewAbout } from './RewardsOverviewAbout';
export function RewardsOverview() {
  const allRewardContracts = useAvailableTokenRewardContracts(1); //hardcode to mainnet for now to avoid bugs when linking to mainnet rewards from another chain. Should maybe update to read from query params

  return (
    <DetailSectionWrapper>
      <DetailSection title={t`Sky Token Rewards overview`}>
        <DetailSectionRow>
          <RewardsOverviewInfo />
        </DetailSectionRow>
      </DetailSection>
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
