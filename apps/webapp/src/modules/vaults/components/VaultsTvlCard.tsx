import { StatsCard } from '@/modules/ui/components/StatsCard';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { useMorphoVaultsCombinedTvl } from '@jetstreamgg/sky-hooks';
import { formatNumber } from '@jetstreamgg/sky-utils';
import { Text } from '@/modules/layout/components/Typography';
import { PopoverRateInfo as PopoverInfo } from '@jetstreamgg/sky-widgets';

export function VaultsTvlCard(): React.ReactElement {
  const { totalAssetsUsd, isLoading, error } = useMorphoVaultsCombinedTvl();

  return (
    <StatsCard
      className="h-full"
      title={t`Sky-curated vaults TVL`}
      content={<Text className="mt-2">${formatNumber(totalAssetsUsd)}</Text>}
      isLoading={isLoading}
      error={error}
    />
  );
}

export function VaultsRatesCard(): React.ReactElement {
  const { formattedMinRate, formattedMaxRate, isLoading, error } = useMorphoVaultsCombinedTvl();

  return (
    <StatsCard
      className="h-full"
      title={t`Rates`}
      content={
        <div className="mt-2 flex flex-row items-center gap-2">
          <Text>
            <Trans>
              From: <span className="text-bullish">{formattedMinRate}</span> To:{' '}
              <span className="text-bullish">{formattedMaxRate}</span>
            </Trans>
          </Text>
          <PopoverInfo type="morpho" />
        </div>
      }
      isLoading={isLoading}
      error={error}
    />
  );
}
