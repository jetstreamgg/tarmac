import { useUsdsDaiData, useSkySavingsRateHistoricData } from '@/hooks';
import { Chart, TimeFrame } from '@/modules/ui/components/Chart';
import { useMemo, useState } from 'react';
import { ErrorBoundary } from '@/modules/layout/components/ErrorBoundary';
import { Trans } from '@lingui/react/macro';
import { useParseTokenChartData } from '@/modules/ui/hooks/useParseTokenChartData';
import { parseUnits } from 'viem';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getDayCountFromTimeFrame } from '@/modules/utils/getDayCountFromTimeFrame';
import { PairTokenIcons } from '@/widgets';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';

// BA Labs /save/ssr/historic/ only accepts specific bucket values for days_ago
const ssrDaysAgoFromTimeFrame = (tf: TimeFrame): number => {
  switch (tf) {
    case 'w':
      return 7;
    case 'm':
      return 30;
    case 'y':
      return 365;
    case 'all':
    default:
      return 9999;
  }
};

enum ChartName {
  USDS_DAI = 'Total USDS and DAI',
  SKY_SAVINGS = 'Total Sky Savings Supply'
}

const toBigIntWei = (decimalString: string): bigint => {
  // BA Labs returns decimal strings with high precision; parseUnits requires <=18 dp
  const fixed = Number(decimalString || '0').toFixed(18);
  return parseUnits(fixed, 18);
};

export function UsdsSkyTotalsChart() {
  const [activeChart, setActiveChart] = useState<ChartName>(ChartName.USDS_DAI);
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('w');

  const limit = getDayCountFromTimeFrame(timeFrame);

  const { data: usdsDaiData, error: usdsDaiError, isLoading: usdsDaiIsLoading } = useUsdsDaiData({ limit });

  const {
    data: ssrData,
    error: ssrError,
    isLoading: ssrIsLoading
  } = useSkySavingsRateHistoricData({ daysAgo: ssrDaysAgoFromTimeFrame(timeFrame) });

  const usdsDaiChartInput = useMemo(
    () =>
      (usdsDaiData || []).map(item => ({
        blockTimestamp: item.blockTimestamp,
        amount: toBigIntWei(item.total),
        holders: 0
      })),
    [usdsDaiData]
  );

  const ssrChartInput = useMemo(
    () =>
      (ssrData || []).map(item => ({
        blockTimestamp: item.blockTimestamp,
        amount: toBigIntWei(item.total),
        holders: 0
      })),
    [ssrData]
  );

  const chartDataMapping = {
    [ChartName.USDS_DAI]: useParseTokenChartData(timeFrame, usdsDaiChartInput),
    [ChartName.SKY_SAVINGS]: useParseTokenChartData(timeFrame, ssrChartInput)
  };

  const isLoadingMapping = {
    [ChartName.USDS_DAI]: usdsDaiIsLoading,
    [ChartName.SKY_SAVINGS]: ssrIsLoading
  };

  const errorMapping = {
    [ChartName.USDS_DAI]: usdsDaiError,
    [ChartName.SKY_SAVINGS]: ssrError
  };

  const activeData = chartDataMapping[activeChart];
  const activeDataLoading = isLoadingMapping[activeChart];
  const activeDataError = errorMapping[activeChart];

  const iconsMapping = {
    [ChartName.USDS_DAI]: <PairTokenIcons leftToken="USDS" rightToken="DAI" noChain />,
    [ChartName.SKY_SAVINGS]: (
      <TokenIcon
        className="h-6 w-6"
        token={{ symbol: 'USDS', name: 'usds' }}
        width={24}
        showChainIcon={false}
      />
    )
  };

  return (
    <div>
      <ErrorBoundary variant="small">
        <div className="mb-4 flex">
          <Tabs value={activeChart} onValueChange={value => setActiveChart(value as ChartName)}>
            <TabsList className="flex">
              <TabsTrigger position="left" value={ChartName.USDS_DAI}>
                <Trans>Total USDS and DAI</Trans>
              </TabsTrigger>
              <TabsTrigger position="right" value={ChartName.SKY_SAVINGS}>
                <Trans>Total Sky Savings Supply</Trans>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <Chart
          dataTestId="usds-sky-totals-chart"
          data={activeData}
          isLoading={activeDataLoading}
          error={activeDataError}
          symbol=""
          icons={iconsMapping[activeChart]}
          onTimeFrameChange={tf => {
            setTimeFrame(tf);
          }}
        />
      </ErrorBoundary>
    </div>
  );
}
