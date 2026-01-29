import { ExpertTvlCard } from './ExpertTvlCard';
import { StUSDSSuppliersCard } from '@/modules/stusds/components/StUSDSSuppliersCard';
import { MorphoVaultSuppliersCard } from '@/modules/morpho/components/MorphoVaultSuppliersCard';
import { MORPHO_VAULTS } from '@jetstreamgg/sky-hooks';
import { mainnet } from 'viem/chains';
import { t } from '@lingui/core/macro';

export function ExpertOverview() {
  const morphoVaultAddress = MORPHO_VAULTS[0]?.vaultAddress[mainnet.id];

  return (
    <div className="flex w-full flex-wrap justify-between gap-3 xl:flex-nowrap">
      <ExpertTvlCard />
      <StUSDSSuppliersCard title={t`stUSDS Suppliers`} />
      {morphoVaultAddress && (
        <MorphoVaultSuppliersCard vaultAddress={morphoVaultAddress} title={t`USDS Risk Capital Suppliers`} />
      )}
    </div>
  );
}
