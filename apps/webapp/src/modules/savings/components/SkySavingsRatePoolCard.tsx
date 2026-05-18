import { StatsCard } from '@/modules/ui/components/StatsCard';
import { t } from '@lingui/core/macro';
import { Text } from '@/modules/layout/components/Typography';
import { useOverallSkyData } from '@/hooks';
import { formatNumber } from '@/utils';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';

export function SkySavingsRatePoolCard(): React.ReactElement {
  const { data, isLoading, error } = useOverallSkyData();
  const tvl = data && formatNumber(parseFloat(data.skySavingsRateTvl));

  return (
    <StatsCard
      title={t`Sky Savings Rate TVL`}
      content={
        <div className="mt-2 flex items-center">
          <TokenIcon
            className="h-6 w-6"
            token={{ symbol: 'USDS', name: 'usds' }}
            width={24}
            showChainIcon={false}
          />
          <Text className="ml-2" variant="large">
            {tvl}
          </Text>
        </div>
      }
      isLoading={isLoading}
      error={error}
    />
  );
}
