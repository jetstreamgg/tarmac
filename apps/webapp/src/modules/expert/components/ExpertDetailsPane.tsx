import { DetailSection } from '@/modules/ui/components/DetailSection';
import { DetailSectionRow } from '@/modules/ui/components/DetailSectionRow';
import { DetailSectionWrapper } from '@/modules/ui/components/DetailSectionWrapper';
import { t } from '@lingui/core/macro';
import { ExpertOverview } from './ExpertOverview';
import { ExpertChart } from './ExpertChart';
import { ExpertAbout } from './ExpertAbout';
import { ExpertFaq } from './ExpertFaq';

export function ExpertDetailsPane() {
  return (
    <DetailSectionWrapper>
      <DetailSection title={t`Expert overview`}>
        <DetailSectionRow>
          <ExpertOverview />
        </DetailSectionRow>
      </DetailSection>
      <DetailSection title={t`Expert activity`}>
        <DetailSectionRow>
          <ExpertChart />
        </DetailSectionRow>
      </DetailSection>
      <DetailSection title={t`About Native Sky Protocol Tokens`}>
        <DetailSectionRow>
          <ExpertAbout />
        </DetailSectionRow>
      </DetailSection>
      <DetailSection title={t`FAQs`}>
        <DetailSectionRow>
          <ExpertFaq />
        </DetailSectionRow>
      </DetailSection>
    </DetailSectionWrapper>
  );
}
