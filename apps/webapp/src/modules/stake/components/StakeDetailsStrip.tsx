import { ReactNode } from 'react';
import { Trans } from '@lingui/react/macro';
import { AudioLines, Asterisk, Vault, Droplet, UsersRound, Info } from 'lucide-react';
import { useStakeHistoricData } from '@/hooks';
import { formatNumber, formatDecimalPercentage } from '@/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { useStakeRewardsRate } from '../hooks/useStakeRewardsRate';

const NO_VALUE = '–';

// Phone tier (comp 1222:17089): single-column rows with 12px leading icons,
// Body 5 labels and Label 5 values on borderPrimary hairlines; md restores
// the desktop 2-column strip, where values grow to Label 4 (Circular 16/18,
// -0.32 tracking, fg-primary — comp 1036:208698, APP-432 item 18).
function DetailRow({ icon, label, children }: { icon: ReactNode; label: ReactNode; children: ReactNode }) {
  return (
    <div className="border-borderPrimary flex items-center justify-between gap-4 border-b pt-4 pb-3 md:py-3">
      <span className="text-fgSecondary flex items-center gap-1.5 text-sm leading-[22px] md:gap-2 md:leading-normal">
        <span
          className="text-fgSecondary flex h-3 w-3 items-center justify-center md:h-4 md:w-4 [&>svg]:h-full [&>svg]:w-full"
          aria-hidden
        >
          {icon}
        </span>
        {label}
      </span>
      <span className="text-fgPrimary font-circle flex items-center gap-1.5 text-sm leading-4 font-medium tracking-[-0.28px] md:text-base md:leading-[18px] md:tracking-[-0.32px]">
        {children}
      </span>
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
      <h3 className="text-fgPrimary font-circle mb-4 text-base leading-[18px] font-medium tracking-[-0.32px] md:mb-2 md:font-sans md:text-lg md:leading-normal md:tracking-normal">
        <Trans>Details</Trans>
      </h3>

      <div className="grid grid-cols-1 gap-x-5 md:grid-cols-2">
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
              <Info className="text-fgSecondary h-3.5 w-3.5" aria-hidden />
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
