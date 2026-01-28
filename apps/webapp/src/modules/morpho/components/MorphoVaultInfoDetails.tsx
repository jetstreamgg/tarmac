import { MorphoVaultRateCard } from './MorphoVaultRateCard';
import { MorphoVaultTvlCard } from './MorphoVaultTvlCard';
import { MorphoMarketLiquidityCard } from './MorphoMarketLiquidityCard';
import { MorphoMarketUtilizationCard } from './MorphoMarketUtilizationCard';
import { Token, useMorphoVaultSingleMarketApiData } from '@jetstreamgg/sky-hooks';

type MorphoVaultInfoDetailsProps = {
  vaultAddress: `0x${string}`;
  assetToken: Token;
};

export function MorphoVaultInfoDetails({ vaultAddress, assetToken }: MorphoVaultInfoDetailsProps) {
  const { data: singleMarketData, isLoading, error } = useMorphoVaultSingleMarketApiData({ vaultAddress });
  const market = singleMarketData?.market.markets[0];

  return (
    <div className="flex w-full flex-wrap gap-3">
      <div className="min-w-[250px] flex-1">
        <MorphoVaultRateCard vaultAddress={vaultAddress} />
      </div>
      <div className="min-w-[250px] flex-1">
        <MorphoVaultTvlCard vaultAddress={vaultAddress} assetToken={assetToken} />
      </div>
      <div className="min-w-[250px] flex-1">
        <MorphoMarketUtilizationCard market={market} isLoading={isLoading} error={error} />
      </div>
      <div className="min-w-[250px] flex-1">
        <MorphoMarketLiquidityCard
          market={market}
          isLoading={isLoading}
          error={error}
          assetToken={assetToken}
        />
      </div>
    </div>
  );
}
