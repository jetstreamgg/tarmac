import { StatsCard } from '@/modules/ui/components/StatsCard';
import { t } from '@lingui/core/macro';
import { useStUsdsData, useMorphoVaultMultipleRateApiData, MORPHO_VAULTS } from '@jetstreamgg/sky-hooks';
import { formatNumber } from '@jetstreamgg/sky-utils';
import { Text } from '@/modules/layout/components/Typography';
import { mainnet } from 'viem/chains';
export function ExpertTvlCard(): React.ReactElement {
  const { data: stUsdsData, isLoading: isStUsdsLoading, error: stUsdsError } = useStUsdsData();
  const {
    data: morphoRateData,
    isLoading: isMorphoLoading,
    error: morphoError
  } = useMorphoVaultMultipleRateApiData({
    vaultAddresses: MORPHO_VAULTS.map(v => v.vaultAddress[mainnet.id])
  });

  const stUsdsTvl = Number(stUsdsData?.totalAssets || 0n) / 1e18;
  const morphoTvl = morphoRateData?.reduce((sum, vault) => sum + (vault?.tvlUsd ?? 0), 0) ?? 0;
  const totalTvl = stUsdsTvl + morphoTvl;

  return (
    <StatsCard
      className="h-full"
      title={t`Total TVL`}
      content={<Text className="mt-2">${formatNumber(totalTvl)}</Text>}
      isLoading={isStUsdsLoading || isMorphoLoading}
      error={stUsdsError || morphoError}
    />
  );
}
