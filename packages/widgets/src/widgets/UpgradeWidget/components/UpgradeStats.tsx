import { StatsCard } from '@widgets/shared/components/ui/card/StatsCard';
import { TokenIconWithBalance } from '@widgets/shared/components/ui/token/TokenIconWithBalance';
import { useUpgradeTotals } from '@jetstreamgg/hooks';
import { formatBigInt } from '@jetstreamgg/utils';
import { t } from '@lingui/core/macro';
import { useRef } from 'react';
import { math } from '@jetstreamgg/utils';

export const UpgradeStats = () => {
  // TODO handle loading and error states
  const { data } = useUpgradeTotals();
  const ref = useRef<HTMLDivElement>(null);
  // const isCompact = (ref.current?.offsetWidth || 0) <= 350;
  const isCompact = true;
  const totalSkyUpgraded = math.calculateConversion({ symbol: 'MKR' }, BigInt(data?.totalMkrUpgraded || 0));

  return (
    <div ref={ref} className="my-4 flex justify-between gap-3">
      <StatsCard
        title={t`Total USDS upgraded`}
        content={
          <TokenIconWithBalance
            className="mt-1"
            token={{ symbol: 'USDS', name: 'usds' }}
            balance={
              data?.totalDaiUpgraded ? formatBigInt(data?.totalDaiUpgraded, { compact: isCompact }) : '0'
            }
            compact={isCompact}
          />
        }
      ></StatsCard>

      <StatsCard
        title={t`Total SKY upgraded`}
        content={
          <TokenIconWithBalance
            className="mt-1"
            token={{ symbol: 'SKY', name: 'sky' }}
            balance={formatBigInt(totalSkyUpgraded, { compact: isCompact })}
            compact={isCompact}
          />
        }
      ></StatsCard>
    </div>
  );
};
