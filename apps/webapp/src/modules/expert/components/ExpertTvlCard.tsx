import { StatsCard } from '@/modules/ui/components/StatsCard';
import { t } from '@lingui/core/macro';
import { useStUsdsData, useMorphoVaultData, usdsRiskCapitalVaultAddress } from '@jetstreamgg/sky-hooks';
import { formatBigInt } from '@jetstreamgg/sky-utils';
import { TokenIconWithBalance } from '@/modules/ui/components/TokenIconWithBalance';
import { mainnet } from 'viem/chains';

export function ExpertTvlCard(): React.ReactElement {
  const { data: stUsdsData, isLoading: isStUsdsLoading, error: stUsdsError } = useStUsdsData();
  const {
    data: morphoData,
    isLoading: isMorphoLoading,
    error: morphoError
  } = useMorphoVaultData({
    // Morpho API is mainnet-only
    vaultAddress: usdsRiskCapitalVaultAddress[mainnet.id]
  });

  const stUsdsTvl = stUsdsData?.totalAssets || 0n;
  const morphoTvl = morphoData?.totalAssets || 0n;
  const totalTvl = stUsdsTvl + morphoTvl;

  return (
    <StatsCard
      title={t`Total TVL`}
      content={
        <TokenIconWithBalance
          className="mt-2"
          token={{ symbol: 'USDS', name: 'usds' }}
          balance={formatBigInt(totalTvl, { unit: 18 })}
        />
      }
      isLoading={isStUsdsLoading || isMorphoLoading}
      error={stUsdsError || morphoError}
    />
  );
}
