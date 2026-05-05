import { DetailSection } from '@/modules/ui/components/DetailSection';
import { DetailSectionRow } from '@/modules/ui/components/DetailSectionRow';
import { DetailSectionWrapper } from '@/modules/ui/components/DetailSectionWrapper';
import { t } from '@lingui/core/macro';
import { BalancesSkyStatsOverview } from './BalancesSkyStatsOverview';
import { BalancesChart } from './BalancesChart';
import { BalancesFaq } from './BalancesFaq';
import { BalancesSuggestedActions } from './BalancesSuggestedActions';
import { useGeoConfig } from '@/modules/geo-config';

export function BalancesDetails() {
  const { isRegionRestricted } = useGeoConfig();

  return (
    <DetailSectionWrapper>
      <DetailSection title={t`Earn with your Stables`} fixedOpen>
        <DetailSectionRow>
          <BalancesSuggestedActions
            widget="stables"
            variant="card"
            restrictedModules={isRegionRestricted ? ['morpho'] : undefined}
          />
        </DetailSectionRow>
      </DetailSection>
      <DetailSection title={t`Stake, Borrow, and Earn with SKY`} fixedOpen>
        <DetailSectionRow>
          <BalancesSuggestedActions widget="sky" variant="card" />
        </DetailSectionRow>
      </DetailSection>
      <DetailSection title={t`Get Sky Protocol Tokens`} fixedOpen>
        <DetailSectionRow>
          <BalancesSuggestedActions widget="tokens" variant="card-sm" />
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
