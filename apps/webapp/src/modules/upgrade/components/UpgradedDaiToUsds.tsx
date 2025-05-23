import { useUpgradeTotals } from '@jetstreamgg/hooks';
import { formatBigInt } from '@jetstreamgg/utils';
import { t } from '@lingui/core/macro';
import { StatsCard } from '@/modules/ui/components/StatsCard';
import { TokenIconWithBalance } from '@/modules/ui/components/TokenIconWithBalance';
import { useSubgraphUrl } from '@/modules/app/hooks/useSubgraphUrl';
import { useChainId } from 'wagmi';
import { isL2ChainId } from '@jetstreamgg/utils';

export function UpgradedDaiToUsds() {
  const chainId = useChainId();
  const chainIdToUse = isL2ChainId(chainId) ? 1 : chainId; //display mainnet data on L2s
  const subgraphUrl = useSubgraphUrl(chainIdToUse);
  const { data, isLoading, error } = useUpgradeTotals({ subgraphUrl });

  return (
    <StatsCard
      title={t`Total USDS upgraded`}
      isLoading={isLoading}
      error={error}
      content={
        <TokenIconWithBalance
          className="mt-2"
          token={{ symbol: 'USDS', name: 'usds' }}
          balance={data?.totalDaiUpgraded ? formatBigInt(data?.totalDaiUpgraded) : '0'}
          chainId={chainIdToUse}
        />
      }
    />
  );
}
