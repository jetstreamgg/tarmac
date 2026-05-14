import { StatsCard } from '@/modules/ui/components/StatsCard';
import { Text } from '@/modules/layout/components/Typography';
import { t } from '@lingui/core/macro';
import { useRewardsSuppliersCount } from '../hooks/useRewardsSuppliersCount';
import { useChainId } from 'wagmi';
import { formatNumber, isL2ChainId } from '@/utils';

export function RewardsSuppliersCard() {
  const chainId = useChainId();
  const { data: suppliers, isLoading, error } = useRewardsSuppliersCount(isL2ChainId(chainId) ? 1 : chainId); // Display mainnet data on Base
  return (
    <StatsCard
      title={t`Rewards Suppliers`}
      isLoading={isLoading}
      error={error}
      content={
        <Text className="mt-2" variant="large">
          {`${formatNumber(suppliers, { maxDecimals: 0 })}`}
        </Text>
      }
    />
  );
}
