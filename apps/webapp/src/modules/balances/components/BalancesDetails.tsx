import { DetailSection } from '@/modules/ui/components/DetailSection';
import { DetailSectionRow } from '@/modules/ui/components/DetailSectionRow';
import { DetailSectionWrapper } from '@/modules/ui/components/DetailSectionWrapper';
import { t } from '@lingui/core/macro';
import { BalancesModuleShowcase } from './BalancesModuleShowcase';
import { BalancesAssets } from './BalancesAssets';
import { BalancesSkyStatsOverview } from './BalancesSkyStatsOverview';
import { useBreakpointIndex, BP } from '@/modules/ui/hooks/useBreakpointIndex';
import { BalancesChart } from './BalancesChart';
import { useConnectedContext } from '@/modules/ui/context/ConnectedContext';
import { BalancesFaq } from './BalancesFaq';
import { getSupportedChainIds } from '@/data/wagmi/config/config.default';
import { useChainId } from 'wagmi';

export function BalancesDetails() {
  const { bpi } = useBreakpointIndex();
  const isDesktop = bpi > BP.lg;
  const { isConnectedAndAcceptedTerms } = useConnectedContext();
  const chainId = useChainId();
  const supportedChainIds = getSupportedChainIds(chainId);

  return (
    <DetailSectionWrapper>
      {isConnectedAndAcceptedTerms && (
        <DetailSectionRow>
          <BalancesModuleShowcase />
        </DetailSectionRow>
      )}
      {/* only render this section on desktop */}
      {isConnectedAndAcceptedTerms && isDesktop && (
        <DetailSection title={t`Your funds`}>
          <DetailSectionRow>
            <BalancesAssets chainIds={supportedChainIds} />
          </DetailSectionRow>
        </DetailSection>
      )}
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
