import { UpgradeFaq } from './UpgradeFaq';
import { UpgradeHistory } from './UpgradeHistory';
import { t } from '@lingui/core/macro';
import { DetailSectionWrapper } from '@/modules/ui/components/DetailSectionWrapper';
import { DetailSection } from '@/modules/ui/components/DetailSection';
import { DetailSectionRow } from '@/modules/ui/components/DetailSectionRow';
import { UpgradeAbout } from './UpgradeAbout';
import { UpgradeStats } from './UpgradeStats';
import { UpgradeChart } from './UpgradeChart';
import { useConnectedContext } from '@/modules/ui/context/ConnectedContext';
export function UpgradeDetails(): React.ReactElement {
  const { isConnectedAndAcceptedTerms } = useConnectedContext();

  return (
    <DetailSectionWrapper>
      <DetailSection title={t`Upgrade stats`}>
        <DetailSectionRow>
          <UpgradeStats />
        </DetailSectionRow>
      </DetailSection>
      {isConnectedAndAcceptedTerms && (
        <DetailSection title={t`Your Upgrade/Revert transaction history`}>
          <DetailSectionRow>
            <UpgradeHistory />
          </DetailSectionRow>
        </DetailSection>
      )}
      <DetailSection title={t`Metrics`}>
        <DetailSectionRow>
          <UpgradeChart />
        </DetailSectionRow>
      </DetailSection>
      <DetailSection title={t`About Native Sky Protocol Tokens`}>
        <DetailSectionRow>
          <UpgradeAbout />
        </DetailSectionRow>
      </DetailSection>
      <DetailSection title={t`FAQs`}>
        <DetailSectionRow>
          <UpgradeFaq />
        </DetailSectionRow>
      </DetailSection>
    </DetailSectionWrapper>
  );
}
