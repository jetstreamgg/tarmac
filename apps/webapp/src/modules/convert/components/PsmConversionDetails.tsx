import { DetailSection } from '@/modules/ui/components/DetailSection';
import { DetailSectionRow } from '@/modules/ui/components/DetailSectionRow';
import { DetailSectionWrapper } from '@/modules/ui/components/DetailSectionWrapper';
import { t } from '@lingui/core/macro';
import { AboutUsds } from '@/modules/ui/components/AboutUsds';
import { PsmConversionFaq } from './PsmConversionFaq';
import { PsmConversionHistory } from './PsmConversionHistory';

export function PsmConversionDetails() {
  return (
    <DetailSectionWrapper>
      <DetailSection title={t`Your Conversion history`}>
        <DetailSectionRow>
          <PsmConversionHistory />
        </DetailSectionRow>
      </DetailSection>
      <DetailSection title={t`About USDS Conversions`}>
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
