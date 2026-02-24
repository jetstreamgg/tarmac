import { MorphoVaultHistory } from './MorphoVaultHistory';
import { MorphoVaultBalanceDetails } from './MorphoVaultBalanceDetails';
import { MorphoVaultInfoDetails } from './MorphoVaultInfoDetails';
import { MorphoVaultAllocationsDetails } from './MorphoVaultAllocationsDetails';
import { MorphoVaultFaq } from './MorphoVaultFaq';
import { t } from '@lingui/core/macro';
import { DetailSectionWrapper } from '@/modules/ui/components/DetailSectionWrapper';
import { DetailSection } from '@/modules/ui/components/DetailSection';
import { DetailSectionRow } from '@/modules/ui/components/DetailSectionRow';
import { MorphoVaultChart } from './MorphoVaultChart';
import { useConnectedContext } from '@/modules/ui/context/ConnectedContext';
import { Token } from '@jetstreamgg/sky-hooks';
import { AboutMorphoVaults } from '@/modules/ui/components/AboutMorphoVaults';

type MorphoVaultDetailsProps = {
  /** The Morpho vault contract address */
  vaultAddress: `0x${string}`;
  /** The underlying asset token */
  assetToken: Token;
  /** Display name for the vault */
  vaultName: string;
};

export function MorphoVaultDetails({
  vaultAddress,
  assetToken,
  vaultName
}: MorphoVaultDetailsProps): React.ReactElement {
  const { isConnectedAndAcceptedTerms } = useConnectedContext();

  const getBannerId = () => {
    if (vaultName.includes('Risk Capital')) return 'risk-capital-vault';
    if (vaultName.includes('Flagship')) return 'flagship-vault';
    if (vaultName.includes('Steakhouse') || vaultName.includes('Savings')) return 'savings-vault';
    return 'morpho-vaults';
  };

  return (
    <DetailSectionWrapper>
      {isConnectedAndAcceptedTerms && (
        <DetailSection title={t`Your balances`} dataTestId="morpho-vault-stats-section">
          <DetailSectionRow>
            <MorphoVaultBalanceDetails vaultAddress={vaultAddress} assetToken={assetToken} />
          </DetailSectionRow>
        </DetailSection>
      )}
      <DetailSection title={t`${vaultName} info`}>
        <DetailSectionRow>
          <MorphoVaultInfoDetails vaultAddress={vaultAddress} assetToken={assetToken} />
        </DetailSectionRow>
      </DetailSection>
      <DetailSection title={t`Exposure`}>
        <DetailSectionRow>
          <MorphoVaultAllocationsDetails vaultAddress={vaultAddress} />
        </DetailSectionRow>
      </DetailSection>
      {isConnectedAndAcceptedTerms && (
        <DetailSection title={t`Your ${vaultName} vault transaction history`}>
          <DetailSectionRow>
            <MorphoVaultHistory vaultAddress={vaultAddress} />
          </DetailSectionRow>
        </DetailSection>
      )}
      <DetailSection title={t`Metrics`}>
        <DetailSectionRow>
          <MorphoVaultChart vaultAddress={vaultAddress} assetToken={assetToken} />
        </DetailSectionRow>
      </DetailSection>
      <DetailSection title={t`About`}>
        <DetailSectionRow>
          <AboutMorphoVaults bannerId={getBannerId()} />
        </DetailSectionRow>
      </DetailSection>
      <DetailSection title={t`FAQs`}>
        <DetailSectionRow>
          <MorphoVaultFaq vaultName={vaultName} />
        </DetailSectionRow>
      </DetailSection>
    </DetailSectionWrapper>
  );
}
