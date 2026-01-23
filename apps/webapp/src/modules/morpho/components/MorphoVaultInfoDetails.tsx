import { MorphoVaultRateCard } from './MorphoVaultRateCard';
import { MorphoVaultTvlCard } from './MorphoVaultTvlCard';
import { MorphoMarketLiquidityCard } from './MorphoMarketLiquidityCard';
import { MorphoMarketUtilizationCard } from './MorphoMarketUtilizationCard';
import { MorphoMarketSupplyCard } from './MorphoMarketSupplyCard';
import { MorphoMarketBorrowCard } from './MorphoMarketBorrowCard';
import { Token } from '@jetstreamgg/sky-hooks';

type MorphoVaultInfoDetailsProps = {
  vaultAddress: `0x${string}`;
  assetToken: Token;
};

export function MorphoVaultInfoDetails({ vaultAddress, assetToken }: MorphoVaultInfoDetailsProps) {
  return (
    <div className="flex w-full flex-wrap gap-3">
      <div className="min-w-[250px] flex-1">
        <MorphoVaultRateCard vaultAddress={vaultAddress} />
      </div>
      <div className="min-w-[250px] flex-1">
        <MorphoMarketUtilizationCard vaultAddress={vaultAddress} />
      </div>
      <div className="min-w-[250px] flex-1">
        <MorphoVaultTvlCard vaultAddress={vaultAddress} assetToken={assetToken} />
      </div>
      <div className="min-w-[250px] flex-1">
        <MorphoMarketLiquidityCard vaultAddress={vaultAddress} assetToken={assetToken} />
      </div>
      <div className="min-w-[250px] flex-1">
        <MorphoMarketSupplyCard vaultAddress={vaultAddress} assetToken={assetToken} />
      </div>
      <div className="min-w-[250px] flex-1">
        <MorphoMarketBorrowCard vaultAddress={vaultAddress} assetToken={assetToken} />
      </div>
    </div>
  );
}
