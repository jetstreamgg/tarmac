import { useMemo } from 'react';

import { formatUnits } from 'viem';
import { Trans } from '@lingui/react/macro';
import { AudioLines, Asterisk, Vault, Droplet, Gauge, UsersRound } from 'lucide-react';
import { ROUTES } from '@/lib/routes';
import { Intent } from '@/lib/enums';
import {
  trailingAverageRate,
  useOverallSkyData,
  useProductNetworks,
  useStUsdsCapacityData,
  useStUsdsChartInfo,
  useStUsdsData
} from '@/hooks';
import { calculateApyFromStr, formatDecimalPercentage, formatNumber } from '@/utils';
import { parseBannerContent } from '@/utils/bannerContentParser';
import { getBannerByIdAndModule } from '@/data/banners/helpers';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { NetworkSelect } from '@/modules/ui/components/NetworkSelect';
import { RiskTierDetailsTrigger } from '@/components/product/RiskTierDetails';
import {
  ProductDetailTemplate,
  ProductDetailRow,
  DetailValue
} from '@/components/product/ProductDetailTemplate';
import { StUsdsDetailChart } from './StUsdsDetailChart';
import { StUsdsPositionCard } from './StUsdsPositionCard';
import { StUsdsTransactionsTable } from './StUsdsTransactionsTable';
import { NO_VALUE, USER_RISKS_URL } from '@/lib/constants';

const formatUsd = (value: bigint | undefined): string =>
  value !== undefined ? `$${formatNumber(parseFloat(formatUnits(value, 18)))}` : NO_VALUE;

/**
 * stUSDS product detail page (D7) — composes the reusable ProductDetailTemplate,
 * mirroring SavingsProductDetail/VaultProductDetail/PendleProductDetail. Serves
 * /earn/stusds; the page is freely reachable — the expert-risk acknowledgement
 * lives in the supply modal (one-time, persisted), replacing the legacy
 * route-bounce gate.
 */
export function StUsdsProductDetail() {
  const networks = useProductNetworks(Intent.EXPERT_INTENT);

  const { data: stUsdsData, isLoading: stUsdsLoading } = useStUsdsData();
  const { data: capacityData, isLoading: capacityLoading } = useStUsdsCapacityData();
  const { data: overall, isLoading: overallLoading } = useOverallSkyData();
  const { data: chartInfo, isLoading: chartLoading } = useStUsdsChartInfo();

  const currentRate = (
    <DetailValue
      loading={stUsdsLoading}
      value={
        stUsdsData ? formatDecimalPercentage(calculateApyFromStr(stUsdsData.moduleRate) / 100) : undefined
      }
    />
  );

  // 30D Rate = trailing 30-day average of the daily chart series (no dedicated
  // endpoint). Shared with the marketplace table's 30D Rate column, so the row
  // and this page always report the same figure.
  const thirtyDayRate = useMemo(() => {
    const average = trailingAverageRate(
      (chartInfo ?? []).flatMap(point =>
        point.rate !== undefined
          ? [{ rate: parseFloat(formatUnits(point.rate, 18)), timestampSec: point.blockTimestamp }]
          : []
      )
    );
    return (
      <DetailValue
        loading={chartLoading}
        value={average !== undefined ? formatDecimalPercentage(average) : undefined}
      />
    );
  }, [chartInfo, chartLoading]);

  const utilization = (
    <DetailValue
      loading={capacityLoading}
      value={
        capacityData !== undefined
          ? `${formatNumber(capacityData.utilizationRate, { maxDecimals: 2 })}%`
          : undefined
      }
    />
  );
  const suppliers = (
    <DetailValue
      loading={overallLoading}
      value={overall?.stusdsSuppliers ? formatNumber(overall.stusdsSuppliers) : undefined}
    />
  );

  // About copy comes from the shared stUSDS banner — the same source the legacy
  // AboutStUsds surface used (parsed for its inline tooltip link).
  const aboutBanner = getBannerByIdAndModule('stusds', 'expert-modules-banners')?.description;

  const details: ProductDetailRow[] = [
    {
      id: 'current-rate',
      icon: <AudioLines className="h-3 w-3" />,
      label: <Trans>Current Rate</Trans>,
      value: currentRate
    },
    {
      id: 'rate-30d',
      icon: <AudioLines className="h-3 w-3" />,
      label: <Trans>30D Rate</Trans>,
      value: thirtyDayRate
    },
    {
      id: 'risk',
      icon: <Asterisk className="h-3 w-3" />,
      label: <Trans>Risk profile</Trans>,
      // Tier + copy resolve through the profile registry (RISK_TIER_BY_PROFILE,
      // BL-07), so the marketplace and this page can't diverge.
      value: <RiskTierDetailsTrigger profile="stusds" />
    },
    {
      id: 'tvl',
      icon: <Vault className="h-3 w-3" />,
      label: <Trans>TVL</Trans>,
      value: formatUsd(stUsdsData?.totalAssets)
    },
    {
      id: 'liquidity',
      icon: <Droplet className="h-3 w-3" />,
      label: <Trans>Liquidity</Trans>,
      // Real value (unlike Savings' "Unlimited") — module TVL minus what the
      // staking engine has borrowed; withdrawals above it route through Curve.
      value: formatUsd(stUsdsData?.availableLiquidity)
    },
    {
      id: 'utilization',
      icon: <Gauge className="h-3 w-3" />,
      label: <Trans>Utilization</Trans>,
      value: utilization
    },
    {
      id: 'users',
      icon: <UsersRound className="h-3 w-3" />,
      label: <Trans>Users</Trans>,
      value: suppliers
    }
  ];

  return (
    <ProductDetailTemplate
      backHref={ROUTES.EARN}
      token={{
        icon: (
          <TokenIcon token={{ symbol: 'stUSDS' }} width={48} className="h-12 w-12" showChainIcon={false} />
        )
      }}
      title={
        <span className="flex flex-col gap-1">
          <span>stUSDS</span>
          {/* The DS line under the title (5120:19542) is Body 6, so it opts
              back out of the heading's Circular styling. */}
          <span className="font-graphik text-fgSecondary text-xs leading-[18px] font-normal tracking-normal">
            <Trans>Access a variable reward rate on USDS by participating in SKY-backed borrowing</Trans>
          </span>
        </span>
      }
      networkSelector={
        <NetworkSelect
          chainIds={networks}
          labelClassName="hidden sm:block"
          dataTestId="product-detail-network"
        />
      }
      chart={<StUsdsDetailChart />}
      position={<StUsdsPositionCard />}
      details={details}
      about={{
        body: aboutBanner ? parseBannerContent(aboutBanner) : NO_VALUE,
        learnMoreHref: USER_RISKS_URL
      }}
      transactions={<StUsdsTransactionsTable />}
      transactionsTitle={<Trans>All transactions</Trans>}
    />
  );
}
