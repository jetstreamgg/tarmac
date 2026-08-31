import { SavingsHistory } from './SavingsHistory';
import { SavingsBalanceDetails } from './SavingsBalanceDetails';
import { SavingsInfoDetails } from './SavingsInfoDetails';
import { SavingsFaq } from './SavingsFaq';
import { t } from '@lingui/core/macro';
import { DetailSectionWrapper } from '@/modules/ui/components/DetailSectionWrapper';
import { DetailSection } from '@/modules/ui/components/DetailSection';
import { DetailSectionRow } from '@/modules/ui/components/DetailSectionRow';
import { SavingsChart } from './SavingsChart';
import { AboutSUsds } from '@/modules/ui/components/AboutSUsds';
import { useConnectedContext } from '@/modules/ui/context/ConnectedContext';
export function SavingsDetails(): React.ReactElement {
  const { isConnectedAndAcceptedTerms } = useConnectedContext();

  return (
    <DetailSectionWrapper>
      {isConnectedAndAcceptedTerms && (
        <DetailSection title={t`Your balances`} dataTestId="savings-stats-section">
          <DetailSectionRow>
            <SavingsBalanceDetails />
          </DetailSectionRow>
        </DetailSection>
      )}
      <DetailSection title={t`Sky Savings Rate info`}>
        <DetailSectionRow>
          <SavingsInfoDetails />
        </DetailSectionRow>
      </DetailSection>
      {isConnectedAndAcceptedTerms && (
        <DetailSection title={t`Your Savings transaction history`}>
          <DetailSectionRow>
            <SavingsHistory />
          </DetailSectionRow>
        </DetailSection>
      )}
      <DetailSection title={t`Metrics`}>
        <DetailSectionRow>
          <SavingsChart />
        </DetailSectionRow>
      </DetailSection>
      <DetailSection title={t`About Native Sky Protocol Tokens`}>
        <DetailSectionRow>
          <AboutSUsds />
        </DetailSectionRow>
      </DetailSection>
      <DetailSection title={t`FAQs`}>
        <DetailSectionRow>
          <SavingsFaq />
        </DetailSectionRow>
      </DetailSection>
    </DetailSectionWrapper>
  );
}
