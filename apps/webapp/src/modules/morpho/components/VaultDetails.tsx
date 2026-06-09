import { MorphoVaultHistory } from './MorphoVaultHistory';
import { SusdtVaultHistory } from './SusdtVaultHistory';
import { VaultBalanceDetails } from './VaultBalanceDetails';
import { VaultInfoDetails } from './VaultInfoDetails';
import { MorphoVaultAllocationsDetails } from './MorphoVaultAllocationsDetails';
import { MorphoVaultFaq } from './MorphoVaultFaq';
import { t } from '@lingui/core/macro';
import { DetailSectionWrapper } from '@/modules/ui/components/DetailSectionWrapper';
import { DetailSection } from '@/modules/ui/components/DetailSection';
import { DetailSectionRow } from '@/modules/ui/components/DetailSectionRow';
import { MorphoVaultChart } from './MorphoVaultChart';
import { useConnectedContext } from '@/modules/ui/context/ConnectedContext';
import { getVaultByAddress, Token, useVaultMarketData } from '@/hooks';
import { AboutMorphoVaults } from '@/modules/ui/components/AboutMorphoVaults';
import { useChainId } from 'wagmi';

type VaultDetailsProps = {
  /** The Morpho vault contract address */
  vaultAddress: `0x${string}`;
  /** The underlying asset token */
  assetToken: Token;
  /** Display name for the vault */
  vaultName: string;
};

export function VaultDetails({ vaultAddress, assetToken, vaultName }: VaultDetailsProps): React.ReactElement {
  const { isConnectedAndAcceptedTerms } = useConnectedContext();
  const chainId = useChainId();

  // Provider drives which data sources the detail sections read from. Defaults to
  // Morpho if the vault isn't found in the registry (preserves prior behavior).
  const provider = getVaultByAddress(vaultAddress, chainId)?.provider ?? 'morpho';
  const isMorpho = provider === 'morpho';

  // Normalized allocations gate the Exposure section for non-Morpho providers:
  // a Spark vault with no allocation data hides the section entirely. (Deduped
  // with the chart's own market-data query by react-query.)
  const { data: marketData } = useVaultMarketData({ provider, vaultAddress });
  const showExposure = isMorpho || (marketData?.allocations?.length ?? 0) > 0;

  const getBannerId = () => {
    // Tether Savings (sUSDT) is a Sky vault on Spark infra — its own banner, not a Morpho one.
    if (vaultName.includes('Tether')) return 'tether-savings-vault';
    if (vaultName.includes('Risk Capital')) {
      if (vaultName.includes('USDT')) return 'usdt-risk-capital-vault';
      if (vaultName.includes('USDC')) return 'usdc-risk-capital-vault';
      return 'usds-risk-capital-vault';
    }
    if (vaultName.includes('Flagship')) return 'flagship-vault';
    if (vaultName.includes('Savings')) {
      if (vaultName.includes('USDT')) return 'usdt-savings-vault';
      return 'usds-savings-vault';
    }
    return 'vaults';
  };

  return (
    <DetailSectionWrapper>
      {isConnectedAndAcceptedTerms && (
        <DetailSection title={t`Your balances`} dataTestId="morpho-vault-stats-section">
          <DetailSectionRow>
            <VaultBalanceDetails vaultAddress={vaultAddress} assetToken={assetToken} provider={provider} />
          </DetailSectionRow>
        </DetailSection>
      )}
      <DetailSection title={t`${vaultName} info`}>
        <DetailSectionRow>
          <VaultInfoDetails vaultAddress={vaultAddress} assetToken={assetToken} provider={provider} />
        </DetailSectionRow>
      </DetailSection>
      {showExposure && (
        <DetailSection title={t`Exposure`}>
          <DetailSectionRow>
            <MorphoVaultAllocationsDetails
              vaultAddress={vaultAddress}
              provider={provider}
              assetToken={assetToken}
            />
          </DetailSectionRow>
        </DetailSection>
      )}
      {/* History source is provider-specific: Morpho vaults read the Morpho
          indexer; the sUSDT vault reads the Sky Ecosystem subgraph. */}
      {isConnectedAndAcceptedTerms && (
        <DetailSection title={t`Your ${vaultName} vault transaction history`}>
          <DetailSectionRow>
            {isMorpho ? <MorphoVaultHistory vaultAddress={vaultAddress} /> : <SusdtVaultHistory />}
          </DetailSectionRow>
        </DetailSection>
      )}
      {/* TEMPORARY: the Metrics chart is hidden for the Spark (sUSDT) vault while
          the Savings historic endpoint returns no data. Remove this
          `provider !== 'sky'` gate to bring the chart back once the endpoint is
          populated. */}
      {provider !== 'sky' && (
        <DetailSection title={t`Metrics`}>
          <DetailSectionRow>
            <MorphoVaultChart vaultAddress={vaultAddress} assetToken={assetToken} provider={provider} />
          </DetailSectionRow>
        </DetailSection>
      )}
      <DetailSection title={t`About`}>
        <DetailSectionRow>
          <AboutMorphoVaults bannerId={getBannerId()} provider={provider} />
        </DetailSectionRow>
      </DetailSection>
      <DetailSection title={t`FAQs`}>
        <DetailSectionRow>
          <MorphoVaultFaq provider={provider} />
        </DetailSectionRow>
      </DetailSection>
    </DetailSectionWrapper>
  );
}
