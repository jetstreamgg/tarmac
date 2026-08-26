import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PendleMarketConfig } from '@/hooks/pendle/pendle';

i18n.load('en', {});
i18n.activate('en');

const MARKET: PendleMarketConfig = {
  name: 'PT-USDG',
  slug: 'pt-usdg',
  marketAddress: '0xc5b32dba5f29f8395fb9591e1a15f23a75214f33',
  ptToken: '0x9db38d74a0d29380899ad354121dfb521adb0548',
  ytToken: '0x4a1294749a70bc32a998b49dd11bf26e9379e3c1',
  syToken: '0xc1799cab1f201946f7cfafbaf1bcc089b2f08927',
  underlyingToken: '0xe343167631d89b6ffc58b88d6b7fb0228795491d',
  underlyingSymbol: 'USDG',
  underlyingDecimals: 6,
  expiry: 1795651200
};

const NOW_SEC = Math.floor(Date.now() / 1000);
const DAY = 86_400;

const hoisted = vi.hoisted(() => ({
  chartProps: undefined as Record<string, unknown> | undefined,
  chartPoints: undefined as Array<Record<string, number | undefined>> | undefined
}));

vi.mock('@/hooks', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks')>();
  return {
    ...actual,
    usePendleMarketsApiData: () => ({
      data: { [MARKET.marketAddress]: { impliedApy: 0.0486, liquidity: 1_650_000_000 } },
      isLoading: false,
      error: undefined,
      mutate: () => undefined,
      dataSources: []
    }),
    usePendleMarketChartData: () => ({
      data: hoisted.chartPoints,
      isLoading: false,
      error: undefined,
      mutate: () => undefined,
      dataSources: []
    })
  };
});

vi.mock('@/modules/ui/components/Chart', async importOriginal => {
  const actual = await importOriginal<typeof import('@/modules/ui/components/Chart')>();
  return {
    ...actual,
    Chart: (props: Record<string, unknown>) => {
      hoisted.chartProps = props;
      return <div data-testid="mock-chart" />;
    }
  };
});

import { PendleDetailChart } from '../PendleDetailChart';

describe('PendleDetailChart', () => {
  afterEach(() => {
    cleanup();
    hoisted.chartProps = undefined;
    hoisted.chartPoints = undefined;
  });

  it('plots the historical Fixed APY series in percent units, sliced to the timeframe', () => {
    hoisted.chartPoints = [
      { timestampSec: NOW_SEC - 30 * DAY, impliedApy: 0.03, liquidity: 1_000_000 }, // outside 1W
      { timestampSec: NOW_SEC - 2 * DAY, impliedApy: 0.04, liquidity: 2_000_000 },
      { timestampSec: NOW_SEC - DAY, impliedApy: 0.045, liquidity: 3_000_000 }
    ];

    render(
      <I18nProvider i18n={i18n}>
        <PendleDetailChart market={MARKET} />
      </I18nProvider>
    );

    // Default timeframe is 1W — the 30-day-old point is sliced away.
    const data = hoisted.chartProps?.data as Array<{ value: number; date: Date }>;
    expect(data.map(point => point.value)).toEqual([4, 4.5]);
    expect(data[0].date.getTime()).toBe((NOW_SEC - 2 * DAY) * 1000);
  });

  it('skips a rate-less bucket rather than drawing it as a 0% dip', () => {
    hoisted.chartPoints = [
      { timestampSec: NOW_SEC - 3 * DAY, impliedApy: 0.04, liquidity: 2_000_000 },
      // Served without a rate — plotting it would draw a false 0% dip.
      { timestampSec: NOW_SEC - 2 * DAY, impliedApy: undefined, liquidity: 2_500_000 },
      { timestampSec: NOW_SEC - DAY, impliedApy: 0.045, liquidity: 3_000_000 }
    ];

    render(
      <I18nProvider i18n={i18n}>
        <PendleDetailChart market={MARKET} />
      </I18nProvider>
    );

    const rateData = hoisted.chartProps?.data as Array<{ value: number }>;
    expect(rateData.map(point => point.value)).toEqual([4, 4.5]);
  });

  it('feeds the shared detail Chart with the live Fixed APY headline', () => {
    render(
      <I18nProvider i18n={i18n}>
        <PendleDetailChart market={MARKET} />
      </I18nProvider>
    );

    expect(hoisted.chartProps?.variant).toBe('detail');
    expect(hoisted.chartProps?.isPercentage).toBe(true);
    // Headline reads the canonical current rate (matches the Details grid).
    expect(hoisted.chartProps?.displayValue).toBeCloseTo(4.86);
  });

  it('renders Rate as the only series, with no metric toggle (APP-527)', () => {
    render(
      <I18nProvider i18n={i18n}>
        <PendleDetailChart market={MARKET} />
      </I18nProvider>
    );

    expect(hoisted.chartProps?.metrics).toBeUndefined();
    expect(hoisted.chartProps?.onMetricChange).toBeUndefined();
  });
});
