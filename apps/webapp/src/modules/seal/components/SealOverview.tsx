import { DetailSectionRow } from '@/modules/ui/components/DetailSectionRow';
import { DetailSectionWrapper } from '@/modules/ui/components/DetailSectionWrapper';
import { DetailSection } from '@/modules/ui/components/DetailSection';
import { t } from '@lingui/core/macro';
import { AboutSealModule } from '@/modules/ui/components/AboutSealModule';
import { SealFaq } from './SealFaq';

export function SealOverview() {
  return (
    <DetailSectionWrapper>
      <DetailSection title={t`About Seal Rewards`}>
        <DetailSectionRow>
          <AboutSealModule />
        </DetailSectionRow>
      </DetailSection>
      <DetailSection title={t`FAQs`}>
        <DetailSectionRow>
          <SealFaq />
        </DetailSectionRow>
      </DetailSection>
    </DetailSectionWrapper>
  );
}
