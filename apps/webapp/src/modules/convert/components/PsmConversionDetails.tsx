import { DetailSection } from '@/modules/ui/components/DetailSection';
import { DetailSectionRow } from '@/modules/ui/components/DetailSectionRow';
import { DetailSectionWrapper } from '@/modules/ui/components/DetailSectionWrapper';
import { t } from '@lingui/core/macro';
import { PsmConversionFaq } from './PsmConversionFaq';
import { AboutUsds } from '@/modules/ui/components/AboutUsds';

export function PsmConversionDetails() {
  return (
    <DetailSectionWrapper>
      <DetailSection title={t`About USDS`}>
        <DetailSectionRow>
          <AboutUsds />
        </DetailSectionRow>
      </DetailSection>
      <DetailSection title={t`FAQs`}>
        <DetailSectionRow>
          <PsmConversionFaq />
        </DetailSectionRow>
      </DetailSection>
    </DetailSectionWrapper>
  );
}
