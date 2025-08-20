import { useSubgraphUrl } from '@/modules/app/hooks/useSubgraphUrl';
import { StatsCard } from '@/modules/ui/components/StatsCard';
import { TokenIconWithBalance } from '@/modules/ui/components/TokenIconWithBalance';
import { useUpgradeTotals, useMkrSkyRate } from '@jetstreamgg/sky-hooks';
import { formatBigInt, isL2ChainId, math } from '@jetstreamgg/sky-utils';
import { t } from '@lingui/core/macro';
import { useChainId } from 'wagmi';

export function UpgradedMkrToSky() {
  const chainId = useChainId();
  const chainIdToUse = isL2ChainId(chainId) ? 1 : chainId; // Display mainnet data on L2s
  const subgraphUrl = useSubgraphUrl(chainIdToUse);
  const { data, isLoading, error } = useUpgradeTotals({ subgraphUrl });
  // TODO we need to get this number from somewhere else because once upgrade penalty is in affect, we won't be able to get SKY amount simply based on the MKR amount
  const { data: mkrSkyRate } = useMkrSkyRate();
  const totalSkyUpgraded = mkrSkyRate
    ? math.calculateConversion({ symbol: 'MKR' }, BigInt(data?.totalMkrUpgraded || 0), mkrSkyRate)
    : 0n;

  return (
    <StatsCard
      title={t`Total SKY upgraded`}
      isLoading={isLoading}
      error={error}
      content={
        <TokenIconWithBalance
          className="mt-2"
          token={{ symbol: 'SKY', name: 'sky' }}
          balance={formatBigInt(totalSkyUpgraded)}
          chainId={chainIdToUse}
        />
      }
    />
  );
}
