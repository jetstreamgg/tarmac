import { StatsCard } from '@/modules/ui/components/StatsCard';
import { TokenIconWithBalance } from '@/modules/ui/components/TokenIconWithBalance';
import { t } from '@lingui/core/macro';
import { useMigrationStats } from '@jetstreamgg/sky-hooks';
import { useChainId } from 'wagmi';
import { isL2ChainId } from '@jetstreamgg/sky-utils';

export function MkrUpgradedToSky() {
  const chainId = useChainId();
  const chainIdToUse = isL2ChainId(chainId) ? 1 : chainId;
  const { data, isLoading, error } = useMigrationStats(chainIdToUse);

  // Format the MKR amount (migrated is the total MKR that has been migrated)
  const mkrAmount = data?.migrated
    ? parseFloat(data.migrated).toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
      })
    : '0';

  return (
    <StatsCard
      title={t`Total MKR upgraded to SKY`}
      isLoading={isLoading}
      error={error}
      content={
        <TokenIconWithBalance
          className="mt-2"
          token={{ symbol: 'MKR', name: 'mkr' }}
          balance={mkrAmount}
          chainId={chainIdToUse}
        />
      }
    />
  );
}
