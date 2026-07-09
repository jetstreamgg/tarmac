import { useMemo } from 'react';
import { useChains } from 'wagmi';
import { formatUnits } from 'viem';
import { Trans } from '@lingui/react/macro';
import { AudioLines, Asterisk, Vault, Droplet, Gauge, UsersRound } from 'lucide-react';
import { ROUTES } from '@/lib/routes';
import { Intent } from '@/lib/enums';
import {
  productNetworks,
  useOverallSkyData,
  useStUsdsCapacityData,
  useStUsdsChartInfo,
  useStUsdsData
} from '@/hooks';
import { calculateApyFromStr, formatDecimalPercentage, formatNumber } from '@/utils';
import { parseBannerContent } from '@/utils/bannerContentParser';
import { getBannerByIdAndModule } from '@/data/banners/helpers';
import { resolveTokenColor } from '@/widgets/shared/constants';
import { ProductTokenIcon } from '@/modules/ui/components/ProductTokenIcon';
import { ChainModal } from '@/modules/ui/components/ChainModal';
import { RiskTierMeter } from '@/components/product/RiskMeter';
import { ProductDetailTemplate, ProductDetailRow } from '@/components/product/ProductDetailTemplate';
import { RING_DEFAULT } from '@/components/product/productVisuals';
import { StUsdsDetailChart } from './StUsdsDetailChart';
import { StUsdsPositionCard } from './StUsdsPositionCard';
import { StUsdsTransactionsTable } from './StUsdsTransactionsTable';

const NO_VALUE = '–';

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
  const chains = useChains();
  const networks = useMemo(
    () =>
      productNetworks(
        Intent.EXPERT_INTENT,
        chains.map(chain => chain.id)
      ),
    [chains]
  );

  const { data: stUsdsData } = useStUsdsData();
  const { data: capacityData } = useStUsdsCapacityData();
  const { data: overall } = useOverallSkyData();
  const { data: chartInfo } = useStUsdsChartInfo();

  const currentRate = stUsdsData
    ? formatDecimalPercentage(calculateApyFromStr(stUsdsData.moduleRate) / 100)
    : NO_VALUE;

  // 30D Rate = trailing 30-day average of the daily chart series (no dedicated
  // endpoint — same trailing-average approach as the vault/savings pages).
  const thirtyDayRate = useMemo(() => {
    const withRate = (chartInfo ?? []).filter(point => point.rate !== undefined);
    if (withRate.length === 0) return NO_VALUE;
    const last30 = [...withRate].sort((a, b) => a.blockTimestamp - b.blockTimestamp).slice(-30);
    const avg =
      last30.reduce((sum, point) => sum + parseFloat(formatUnits(point.rate!, 18)), 0) / last30.length;
    return formatDecimalPercentage(avg);
  }, [chartInfo]);

  const utilization =
    capacityData !== undefined
      ? `${formatNumber(capacityData.utilizationRate, { maxDecimals: 2 })}%`
      : NO_VALUE;
  const suppliers = overall?.stusdsSuppliers ? formatNumber(overall.stusdsSuppliers) : NO_VALUE;

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
      // Mirrors the marketplace's hardcoded tier (earnProducts.ts
      // STUSDS_RISK_TIER = 'advanced', BL-07) so the table and detail page
      // never diverge.
      value: <RiskTierMeter tier="advanced" />
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
          <ProductTokenIcon
            symbol="stUSDS"
            ringColor={RING_DEFAULT}
            glowColor={resolveTokenColor('stUSDS')}
            width={48}
            className="h-12 w-12"
          />
        )
      }}
      title={
        <span className="flex flex-col gap-1">
          <span>stUSDS</span>
          <span className="text-textSecondary text-sm font-normal">
            <Trans>Access a variable reward rate on USDS by participating in SKY-backed borrowing</Trans>
          </span>
        </span>
      }
      networkSelector={<ChainModal chainIds={networks} dataTestId="product-detail-network" />}
      chart={<StUsdsDetailChart />}
      position={<StUsdsPositionCard />}
      details={details}
      about={{
        body: aboutBanner ? parseBannerContent(aboutBanner) : NO_VALUE,
        learnMoreHref: 'https://docs.sky.money/user-risks'
      }}
      transactions={<StUsdsTransactionsTable />}
      transactionsTitle={<Trans>All transactions</Trans>}
    />
  );
}
