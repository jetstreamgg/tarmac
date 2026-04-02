import { DetailSection } from '@/modules/ui/components/DetailSection';
import { DetailSectionRow } from '@/modules/ui/components/DetailSectionRow';
import { DetailSectionWrapper } from '@/modules/ui/components/DetailSectionWrapper';
import { t } from '@lingui/core/macro';
import { BalancesFaq } from '@/modules/balances/components/BalancesFaq';
import { BalancesSuggestedActions } from '@/modules/balances/components/BalancesSuggestedActions';

export function ConvertOverviewDetails() {
  return (
    <DetailSectionWrapper>
      <DetailSection title={t`Get Sky Protocol Tokens`} fixedOpen>
        <DetailSectionRow>
          <BalancesSuggestedActions widget="tokens" variant="card-sm" />
        </DetailSectionRow>
      </DetailSection>
      <DetailSection title={t`FAQs`}>
        <DetailSectionRow>
          <BalancesFaq />
        </DetailSectionRow>
      </DetailSection>
    </DetailSectionWrapper>
  );
}
