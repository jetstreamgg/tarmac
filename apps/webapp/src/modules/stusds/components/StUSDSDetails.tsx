import { StUSDSHistory } from './StUSDSHistory';
import { StUSDSBalanceDetails } from './StUSDSBalanceDetails';
import { StUSDSInfoDetails } from './StUSDSInfoDetails';
import { StUSDSExchangeRatesDetails } from './StUSDSExchangeRatesDetails';
import { StUSDSFaq } from './StUSDSFaq';
import { t } from '@lingui/core/macro';
import { DetailSectionWrapper } from '@/modules/ui/components/DetailSectionWrapper';
import { DetailSection } from '@/modules/ui/components/DetailSection';
import { DetailSectionRow } from '@/modules/ui/components/DetailSectionRow';
import { StUSDSChart } from './StUSDSChart';
import { AboutStUsds } from '@/modules/ui/components/AboutStUsds';
import { useConnectedContext } from '@/modules/ui/context/ConnectedContext';
import { AboutUsds } from '@/modules/ui/components/AboutUsds';
export function StUSDSDetails(): React.ReactElement {
  const { isConnectedAndAcceptedTerms } = useConnectedContext();

  return (
    <DetailSectionWrapper>
      {isConnectedAndAcceptedTerms && (
        <DetailSection title={t`Your balances`} dataTestId="stusds-stats-section">
          <DetailSectionRow>
            <StUSDSBalanceDetails />
          </DetailSectionRow>
        </DetailSection>
      )}
      <DetailSection title={t`stUSDS module info`}>
        <DetailSectionRow>
          <StUSDSInfoDetails />
        </DetailSectionRow>
      </DetailSection>
      <DetailSection title={t`Exchange Rates`}>
        <DetailSectionRow>
          <StUSDSExchangeRatesDetails />
        </DetailSectionRow>
      </DetailSection>
      {isConnectedAndAcceptedTerms && (
        <DetailSection title={t`Your stUSDS transaction history`}>
          <DetailSectionRow>
            <StUSDSHistory />
          </DetailSectionRow>
        </DetailSection>
      )}
      <DetailSection title={t`Metrics`}>
        <DetailSectionRow>
          <StUSDSChart />
        </DetailSectionRow>
      </DetailSection>
      <DetailSection title={t`About Native Sky Protocol Tokens`}>
        <DetailSectionRow>
          <div>
            <AboutStUsds module="stusds-module-banners" />
            <AboutUsds />
          </div>
        </DetailSectionRow>
      </DetailSection>
      <DetailSection title={t`FAQs`}>
        <DetailSectionRow>
          <StUSDSFaq />
        </DetailSectionRow>
      </DetailSection>
    </DetailSectionWrapper>
  );
}
