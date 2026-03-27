import { MorphoVaultTvlCard } from './MorphoVaultTvlCard';
import { MorphoMarketLiquidityCard } from './MorphoMarketLiquidityCard';
import { Token, useMorphoVaultMarketApiData } from '@jetstreamgg/sky-hooks';
import { StatsCard } from '@/modules/ui/components/StatsCard';
import { t } from '@lingui/core/macro';
import { Text } from '@/modules/layout/components/Typography';

type MorphoVaultInfoDetailsProps = {
  vaultAddress: `0x${string}`;
  assetToken: Token;
};

export function MorphoVaultInfoDetails({ vaultAddress, assetToken }: MorphoVaultInfoDetailsProps) {
  const { data: marketData, isLoading, error } = useMorphoVaultMarketApiData({ vaultAddress });

  return (
    <div className="flex w-full flex-wrap gap-3">
      <div className="min-w-[250px] flex-1">
        <MorphoVaultTvlCard vaultAddress={vaultAddress} assetToken={assetToken} />
      </div>
      <div className="min-w-[250px] flex-1">
        <MorphoMarketLiquidityCard
          liquidity={marketData?.liquidity}
          isLoading={isLoading}
          error={error}
          assetToken={assetToken}
        />
      </div>
      <div className="min-w-[250px] flex-1">
        <StatsCard
          className="h-full"
          title={t`Management Fee`}
          content={<Text className="mt-2">{marketData?.rate.formattedManagementFee ?? '-'}</Text>}
          isLoading={isLoading}
          error={error}
        />
      </div>
      <div className="min-w-[250px] flex-1">
        <StatsCard
          className="h-full"
          title={t`Performance Fee`}
          content={<Text className="mt-2">{marketData?.rate.formattedPerformanceFee ?? '-'}</Text>}
          isLoading={isLoading}
          error={error}
        />
      </div>
    </div>
  );
}
