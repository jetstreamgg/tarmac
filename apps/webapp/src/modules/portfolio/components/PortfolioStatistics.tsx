import { ReactNode } from 'react';
import { Trans } from '@lingui/react/macro';
import { useOverallSkyData, useUsdsDaiData } from '@/hooks';
import { formatNumber } from '@/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Heading, Text } from '@/modules/layout/components/Typography';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { PortfolioTotalsChart } from './PortfolioTotalsChart';

const INSIGHTS_URL = 'https://info.skyeco.com/';

const compactUsd = (value: string | undefined): string | undefined =>
  value ? `$${formatNumber(parseFloat(value), { compact: true })}` : undefined;

/**
 * Sky-wide statistics: the existing USDS / Sky Savings totals chart plus a
 * footer of headline TVL figures and a link to the public analytics site.
 * Shown to disconnected visitors and to connected users with no significant
 * position (the chart isn't about the user, so it stays useful either way).
 */
export function PortfolioStatistics() {
  const { data: usdsDaiData } = useUsdsDaiData({ limit: 1 });
  const { data: overallSkyData } = useOverallSkyData();

  const totalSupply = usdsDaiData?.[0]
    ? `${parseFloat(usdsDaiData[0].total).toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      })} USDS`
    : undefined;
  const savingsTvl = compactUsd(overallSkyData?.skySavingsRateTvl);
  const rewardsTvl = compactUsd(overallSkyData?.totalRewardTvl);

  return (
    <section data-testid="portfolio-statistics">
      <Heading tag="h2" variant="medium" className="mb-8">
        <Trans>Sky Protocol Statistics</Trans>
      </Heading>

      {/* 32px, not 24 (Figma 2376:225244, "Update inner padding - should be 32px"). */}
      <Card className="p-8">
        {/* The detail Chart ships its own Card surface; flatten it so the
            chart blends into this statistics card. */}
        <div className="[&_[data-testid=portfolio-totals-chart]]:border-0! [&_[data-testid=portfolio-totals-chart]]:bg-transparent! [&_[data-testid=portfolio-totals-chart]]:backdrop-blur-none">
          <PortfolioTotalsChart />
        </div>

        <div className="border-borderPrimary my-6 border-b" />

        {/* Comp footer (1036:189291): the three figures 40px apart, split by
            28px hairlines, with the CTA pushed to the far right. */}
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-wrap items-center gap-x-10 gap-y-4">
            <Stat
              label={<Trans>Total supply</Trans>}
              value={totalSupply}
              // 2.2: the supply figure carries the USDS mark.
              icon={
                <TokenIcon token={{ symbol: 'USDS' }} width={16} showChainIcon={false} className="size-4" />
              }
            />
            <StatDivider />
            <Stat label={<Trans>Savings TVL</Trans>} value={savingsTvl} />
            <StatDivider />
            <Stat label={<Trans>Rewards TVL</Trans>} value={rewardsTvl} />
          </div>
          {/* 2.4: the comp draws this as the secondary button. */}
          <Button asChild variant="secondary" size="l" className="w-fit">
            <a href={INSIGHTS_URL} target="_blank" rel="noreferrer">
              <Trans>Get more insights</Trans>
            </a>
          </Button>
        </div>
      </Card>
    </section>
  );
}

function Stat({
  label,
  value,
  icon
}: {
  label: ReactNode;
  value: string | undefined;
  /** 16px mark leading the figure (only the supply stat carries one). */
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <Text variant="medium" className="text-textSecondary">
        {label}
      </Text>
      {value ? (
        // Label 4 (Circular 16/18, -0.32) per the comp.
        <span className="text-text font-circle flex items-center gap-1 text-base leading-[18px] font-medium tracking-[-0.32px]">
          {icon}
          {value}
        </span>
      ) : (
        <Skeleton className="h-5 w-24 rounded" />
      )}
    </div>
  );
}

/** 28px hairline between two footer figures; drops out once they wrap. */
function StatDivider() {
  return <span className="bg-borderPrimary hidden h-7 w-px shrink-0 sm:block" aria-hidden />;
}
