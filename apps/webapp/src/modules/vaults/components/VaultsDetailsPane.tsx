import { DetailSection } from '@/modules/ui/components/DetailSection';
import { DetailSectionRow } from '@/modules/ui/components/DetailSectionRow';
import { DetailSectionWrapper } from '@/modules/ui/components/DetailSectionWrapper';
import { t } from '@lingui/core/macro';
import { VaultsOverview } from './VaultsOverview';
import { VaultsChart } from './VaultsChart';
import { VaultsAbout } from './VaultsAbout';
import { VaultsFaq } from './VaultsFaq';
import { ClaimableRewardsTable } from './ClaimableRewardsTable';
import { useConnectedContext } from '@/modules/ui/context/ConnectedContext';

export function VaultsDetailsPane() {
  const { isConnectedAndAcceptedTerms } = useConnectedContext();

  return (
    <DetailSectionWrapper>
      <DetailSection title={t`Vaults overview`}>
        <DetailSectionRow>
          <VaultsOverview />
        </DetailSectionRow>
      </DetailSection>
      {isConnectedAndAcceptedTerms && (
        <DetailSection title={t`Claimable rewards`}>
          <DetailSectionRow>
            <ClaimableRewardsTable />
          </DetailSectionRow>
        </DetailSection>
      )}
      <DetailSection title={t`Vaults activity`}>
        <DetailSectionRow>
          <VaultsChart />
        </DetailSectionRow>
      </DetailSection>
      <DetailSection title={t`About`}>
        <DetailSectionRow>
          <VaultsAbout />
        </DetailSectionRow>
      </DetailSection>
      <DetailSection title={t`FAQs`}>
        <DetailSectionRow>
          <VaultsFaq />
        </DetailSectionRow>
      </DetailSection>
    </DetailSectionWrapper>
  );
}
