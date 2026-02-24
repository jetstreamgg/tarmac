import { DetailSection } from '@/modules/ui/components/DetailSection';
import { DetailSectionRow } from '@/modules/ui/components/DetailSectionRow';
import { DetailSectionWrapper } from '@/modules/ui/components/DetailSectionWrapper';
import { t } from '@lingui/core/macro';
import { VaultsOverview } from './VaultsOverview';
import { VaultsChart } from './VaultsChart';
import { VaultsAbout } from './VaultsAbout';
import { VaultsFaq } from './VaultsFaq';

export function VaultsDetailsPane() {
  return (
    <DetailSectionWrapper>
      <DetailSection title={t`Vaults overview`}>
        <DetailSectionRow>
          <VaultsOverview />
        </DetailSectionRow>
      </DetailSection>
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
