import { ReactNode } from 'react';
import { Trans } from '@lingui/react/macro';
import { AudioLines, Asterisk, Vault, Droplet, UsersRound, Info } from 'lucide-react';
import { useStakeHistoricData } from '@/hooks';
import { formatNumber, formatDecimalPercentage } from '@/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { useStakeRewardsRate } from '../hooks/useStakeRewardsRate';

const NO_VALUE = '–';

function DetailRow({ icon, label, children }: { icon: ReactNode; label: ReactNode; children: ReactNode }) {
  return (
    <div className="border-textSecondary/10 flex items-center justify-between gap-4 border-b py-3">
      <span className="text-textSecondary flex items-center gap-2 text-sm">
        <span className="text-textSecondary flex h-4 w-4 items-center justify-center" aria-hidden>
          {icon}
        </span>
        {label}
      </span>
      <span className="text-text flex items-center gap-1.5 text-sm font-medium">{children}</span>
    </div>
  );
}

// Skeleton while the backing hook loads; a dash on error — mirrors how the
// legacy StakeOverview surfaces the same hooks.
function StatValue({
  isLoading,
  error,
  children
}: {
  isLoading?: boolean;
  error?: Error | null;
  children: ReactNode;
}) {
  if (isLoading) return <Skeleton className="h-4 w-16" />;
  if (error) return <>{NO_VALUE}</>;
  return <>{children}</>;
}

/**
 * Statistics-tab "Details" strip: the hi-fi label/value rows fed entirely by
 * the existing read hooks (comp 1036:208698, APP-399 #7 — Staking Reward Rate /
 * Borrow Rate / Total SKY staked / TVL / Protocol SKY Price / Users). The info
 * glyph on Protocol SKY Price is decorative for now, like the sibling Borrow
 * Utilization heading — tooltip copy arrives via the corpus pipeline.
 * Read-only — no engine hook is touched here.
 */
export function StakeDetailsStrip() {
  const { data: historicData, isLoading: historicLoading, error: historicError } = useStakeHistoricData();
  const mostRecent = historicData
    ?.slice()
    .sort((a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime())[0];

  // Rewards rate (highest-rate farm) — the same figure the promo card and the
  // Statistics chart hero show, so all three rate surfaces agree.
  const { currentRate, isLoading: rewardsLoading, error: rewardsError } = useStakeRewardsRate();

  return (
    <div data-testid="stake-details-strip" className="flex flex-col">
      <h3 className="text-text mb-2 text-lg font-medium">
        <Trans>Details</Trans>
      </h3>

      <div className="grid grid-cols-2 gap-x-5">
        <DetailRow icon={<AudioLines className="h-4 w-4" />} label={<Trans>Staking Reward Rate</Trans>}>
          <StatValue isLoading={rewardsLoading} error={rewardsError}>
            {currentRate !== null ? formatDecimalPercentage(currentRate) : NO_VALUE}
          </StatValue>
        </DetailRow>

        <DetailRow icon={<AudioLines className="h-4 w-4" />} label={<Trans>Borrow Rate</Trans>}>
          <StatValue isLoading={historicLoading} error={historicError}>
            {mostRecent ? formatDecimalPercentage(mostRecent.borrowRate) : NO_VALUE}
          </StatValue>
        </DetailRow>

        <DetailRow icon={<Asterisk className="h-4 w-4" />} label={<Trans>Total SKY staked</Trans>}>
          <StatValue isLoading={historicLoading} error={historicError}>
            {mostRecent ? (
              <>
                {formatNumber(mostRecent.totalSky, { maxDecimals: 0 })}
                <TokenIcon token={{ symbol: 'SKY' }} width={16} className="h-4 w-4" />
              </>
            ) : (
              NO_VALUE
            )}
          </StatValue>
        </DetailRow>

        <DetailRow icon={<Vault className="h-4 w-4" />} label={<Trans>TVL</Trans>}>
          <StatValue isLoading={historicLoading} error={historicError}>
            {mostRecent ? `$${formatNumber(mostRecent.tvl)}` : NO_VALUE}
          </StatValue>
        </DetailRow>

        <DetailRow
          icon={<Droplet className="h-4 w-4" />}
          label={
            <>
              <Trans>Protocol SKY Price</Trans>
              <Info className="text-textSecondary h-3.5 w-3.5" aria-hidden />
            </>
          }
        >
          <StatValue isLoading={historicLoading} error={historicError}>
            {mostRecent ? `$${formatNumber(mostRecent.skyPrice, { maxDecimals: 4 })}` : NO_VALUE}
          </StatValue>
        </DetailRow>

        <DetailRow icon={<UsersRound className="h-4 w-4" />} label={<Trans>Users</Trans>}>
          <StatValue isLoading={historicLoading} error={historicError}>
            {mostRecent ? formatNumber(mostRecent.numberOfUrns, { maxDecimals: 0 }) : NO_VALUE}
          </StatValue>
        </DetailRow>
      </div>
    </div>
  );
}
