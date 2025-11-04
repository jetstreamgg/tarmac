import { StatsCard } from '@/modules/ui/components/StatsCard';
import { Text } from '@/modules/layout/components/Typography';
import { t } from '@lingui/core/macro';
import { useMigrationStats } from '@jetstreamgg/sky-hooks';
import { useChainId } from 'wagmi';
import { isL2ChainId } from '@jetstreamgg/sky-utils';

export function MkrUpgradedPercentage() {
  const chainId = useChainId();
  const chainIdToUse = isL2ChainId(chainId) ? 1 : chainId;
  const { data, isLoading, error } = useMigrationStats(chainIdToUse);

  // Convert the percentage to a display format (percentage is already in decimal form, e.g., 0.592289)
  const percentageValue = data?.percentage ? (parseFloat(data.percentage) * 100).toFixed(2) : '0';

  return (
    <StatsCard
      title={t`% of MKR upgraded`}
      isLoading={isLoading}
      error={error}
      content={<Text className="mt-2">{percentageValue} %</Text>}
    />
  );
}
