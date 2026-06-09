import { t } from '@lingui/core/macro';
import { DetailSectionWrapper } from '@/modules/ui/components/DetailSectionWrapper';
import { DetailSection } from '@/modules/ui/components/DetailSection';
import { DetailSectionRow } from '@/modules/ui/components/DetailSectionRow';
import { useConnectedContext } from '@/modules/ui/context/ConnectedContext';
import { AboutStakeModule } from '@/modules/ui/components/AboutStakeModule';
import { StakeFaq } from './StakeFaq';
import { StakePositionOverview } from './StakePositionOverview';
import { StakeHistory } from './StakeHistory';
import { StakeChart } from './StakeChart';

export function StakePositionDetails({ positionIndex }: { positionIndex?: number }): React.ReactElement {
  const { isConnectedAndAcceptedTerms } = useConnectedContext();
  return (
    <DetailSectionWrapper>
      {positionIndex !== undefined && <StakePositionOverview positionIndex={positionIndex} />}
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
