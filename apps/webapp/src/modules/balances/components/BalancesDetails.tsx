import { DetailSection } from '@/modules/ui/components/DetailSection';
import { DetailSectionRow } from '@/modules/ui/components/DetailSectionRow';
import { DetailSectionWrapper } from '@/modules/ui/components/DetailSectionWrapper';
import { t } from '@lingui/core/macro';
import { BalancesSkyStatsOverview } from './BalancesSkyStatsOverview';
import { BalancesChart } from './BalancesChart';
import { BalancesFaq } from './BalancesFaq';
import { SuggestedActions } from '@/modules/vaults/components/SuggestedActions';

export function BalancesDetails() {
  const isRestricted = import.meta.env.VITE_RESTRICTED_BUILD === 'true';

  return (
    <DetailSectionWrapper>
      {!isRestricted && (
        <DetailSection title={t`Earn with your Stables`} fixedOpen>
          <DetailSectionRow>
            <SuggestedActions widget="stables" variant="card" />
          </DetailSectionRow>
        </DetailSection>
      )}
      <DetailSection title={t`Stake, Borrow, and Earn with SKY`} fixedOpen>
        <DetailSectionRow>
          <SuggestedActions widget="sky" variant="card" />
        </DetailSectionRow>
      </DetailSection>
      <DetailSection title={t`Get Sky Protocol Tokens`} fixedOpen>
        <DetailSectionRow>
          <SuggestedActions widget="tokens" variant="card-sm" />
        </DetailSectionRow>
      </DetailSection>
      <DetailSection title={t`Sky Protocol overview`}>
        <DetailSectionRow>
          <BalancesSkyStatsOverview />
        </DetailSectionRow>
      </DetailSection>
      <DetailSection title={t`Sky Protocol activity`}>
        <DetailSectionRow>
          <BalancesChart />
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
