import { StatsCard } from '@widgets/shared/components/ui/card/StatsCard';
import { TokenIconWithBalance } from '@widgets/shared/components/ui/token/TokenIconWithBalance';
import { useMigrationStats } from '@jetstreamgg/sky-hooks';
import { Text } from '@widgets/shared/components/ui/Typography';
import { t } from '@lingui/core/macro';
import { useRef } from 'react';
import { useChainId } from 'wagmi';

export const UpgradeStats = () => {
  const chainId = useChainId();
  const { data } = useMigrationStats(chainId);
  const ref = useRef<HTMLDivElement>(null);
  const isCompact = true;

  // Format the MKR amount (migrated is the total MKR that has been migrated)
  const mkrAmount = data?.migrated
    ? parseFloat(data.migrated).toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
      })
    : '0';

  // Convert the percentage to a display format (percentage is already in decimal form, e.g., 0.592289)
  const percentageValue = data?.percentage ? (parseFloat(data.percentage) * 100).toFixed(2) : '0';

  return (
    <div ref={ref} className="my-4 flex justify-between gap-3">
      <StatsCard
        title={t`Total MKR upgraded`}
        content={
          <TokenIconWithBalance
            className="mt-1"
            token={{ symbol: 'MKR', name: 'mkr' }}
            balance={mkrAmount}
            compact={isCompact}
          />
        }
      ></StatsCard>

      <StatsCard title={t`% of MKR upgraded`} content={<Text>{percentageValue} %</Text>}></StatsCard>
    </div>
  );
};
