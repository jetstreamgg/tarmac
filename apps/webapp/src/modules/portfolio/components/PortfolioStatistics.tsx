import { ReactNode } from 'react';
import { Trans } from '@lingui/react/macro';
import { useOverallSkyData, useUsdsDaiData } from '@/hooks';
import { formatNumber } from '@/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Heading, Text } from '@/modules/layout/components/Typography';
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

      <Card className="p-6">
        {/* The detail Chart ships its own Card surface; flatten it so the
            chart blends into this statistics card. */}
        <div className="[&_[data-testid=portfolio-totals-chart]]:border-0! [&_[data-testid=portfolio-totals-chart]]:bg-transparent! [&_[data-testid=portfolio-totals-chart]]:backdrop-blur-none">
          <PortfolioTotalsChart />
        </div>

        <div className="border-borderPrimary my-6 border-b" />

        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-wrap gap-x-12 gap-y-4">
            <Stat label={<Trans>Total supply</Trans>} value={totalSupply} />
            <Stat label={<Trans>Savings TVL</Trans>} value={savingsTvl} />
            <Stat label={<Trans>Rewards TVL</Trans>} value={rewardsTvl} />
          </div>
          <Button asChild variant="primary" size="l" className="w-fit">
            <a href={INSIGHTS_URL} target="_blank" rel="noreferrer">
              <Trans>Get more insights</Trans>
            </a>
          </Button>
        </div>
      </Card>
    </section>
  );
}

function Stat({ label, value }: { label: ReactNode; value: string | undefined }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Text variant="medium" className="text-textSecondary">
        {label}
      </Text>
      {value ? (
        <span className="text-text font-circle font-medium">{value}</span>
      ) : (
        <span className="bg-surface h-5 w-24 animate-pulse rounded" />
      )}
    </div>
  );
}
