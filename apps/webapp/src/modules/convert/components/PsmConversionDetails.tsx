import { DetailSection } from '@/modules/ui/components/DetailSection';
import { DetailSectionRow } from '@/modules/ui/components/DetailSectionRow';
import { DetailSectionWrapper } from '@/modules/ui/components/DetailSectionWrapper';
import { Text } from '@/modules/layout/components/Typography';
import { t } from '@lingui/core/macro';
import { AboutUsds } from '@/modules/ui/components/AboutUsds';

export function PsmConversionDetails() {
  return (
    <DetailSectionWrapper>
      <DetailSection title={t`Your Conversion history`}>
        <DetailSectionRow>
          <Text className="text-textSecondary" variant="small">
            {t`No transactions found`}
          </Text>
        </DetailSectionRow>
      </DetailSection>
      <DetailSection title={t`About USDS Conversions`}>
        <DetailSectionRow>
          <AboutUsds />
        </DetailSectionRow>
      </DetailSection>
      <DetailSection title={t`FAQs`}>
        <DetailSectionRow>
          <Text className="text-textSecondary" variant="small">
            {t`Conversion-specific FAQs will be added in a later phase.`}
          </Text>
        </DetailSectionRow>
      </DetailSection>
    </DetailSectionWrapper>
  );
}
