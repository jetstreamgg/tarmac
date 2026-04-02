import { DetailSection } from '@/modules/ui/components/DetailSection';
import { DetailSectionRow } from '@/modules/ui/components/DetailSectionRow';
import { DetailSectionWrapper } from '@/modules/ui/components/DetailSectionWrapper';
import { t } from '@lingui/core/macro';
import { PsmConversionFaq } from './PsmConversionFaq';
import { AboutPsmConversion } from '@/modules/ui/components/AboutPsmConversion';

export function PsmConversionDetails() {
  return (
    <DetailSectionWrapper>
      <DetailSection title={t`About`}>
        <DetailSectionRow>
          <div>
            <AboutPsmConversion />
          </div>
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
