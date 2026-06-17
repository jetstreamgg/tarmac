import { useMemo } from 'react';
import { useChains } from 'wagmi';
import { Trans } from '@lingui/react/macro';
import { AudioLines, Asterisk, Vault, Droplet, UsersRound } from 'lucide-react';
import { ROUTES } from '@/lib/routes';
import { Intent } from '@/lib/enums';
import { productNetworks, useOverallSkyData, useSkySavingsRateHistoricData } from '@/hooks';
import { formatDecimalPercentage, formatNumber } from '@/utils';
import { parseBannerContent } from '@/utils/bannerContentParser';
import { getBannerById } from '@/data/banners/banners';
import { tokenColors } from '@/widgets/shared/constants';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { ChainModal } from '@/modules/ui/components/ChainModal';
import { RiskMeter } from '@/components/product/RiskMeter';
import { ProductDetailTemplate, ProductDetailRow } from '@/components/product/ProductDetailTemplate';
import { SavingsDetailChart } from './SavingsDetailChart';
import { SavingsPositionCard } from './SavingsPositionCard';
import { SavingsTransactionsTable } from './SavingsTransactionsTable';

// Title glow/outline color, from the shared token-color map.
const SUSDS_BRAND_COLOR = tokenColors.find(token => token.symbol === 'SUSDS')?.color;

const NO_VALUE = '–';

export function SavingsProductDetail() {
  // The networks Savings is live on among the configured chains (which include
  // the Tenderly fork in dev mode) — scopes the header's network switcher to
  // chains where the module is available. Address-bound consumers should also
  // pass their address map here, matching buildEarnProducts.
  const chains = useChains();
  const networks = useMemo(
    () =>
      productNetworks(
        Intent.SAVINGS_INTENT,
        chains.map(chain => chain.id)
      ),
    [chains]
  );

  const { data: overall } = useOverallSkyData();
  // "6M Rate" = trailing 6-month average APY. 🔶 confirm semantics with design
  // (trailing average vs forward estimate vs rate-as-of-6-months-ago).
  const { data: rateHistoric } = useSkySavingsRateHistoricData({ daysAgo: 180 });

  const currentRate = overall?.skySavingsRatecRate
    ? formatDecimalPercentage(parseFloat(overall.skySavingsRatecRate))
    : NO_VALUE;
  const sixMonthRate = useMemo(() => {
    if (!rateHistoric || rateHistoric.length === 0) return NO_VALUE;
    const avg = rateHistoric.reduce((sum, d) => sum + parseFloat(d.rate), 0) / rateHistoric.length;
    return formatDecimalPercentage(avg);
  }, [rateHistoric]);
  const tvl = overall?.skySavingsRateTvl
    ? `$${formatNumber(parseFloat(overall.skySavingsRateTvl))}`
    : NO_VALUE;
  const users = overall?.ssrSuppliers ? formatNumber(overall.ssrSuppliers) : NO_VALUE;

  // About copy comes from the shared savings banner (id 'susds'), parsed for its
  // inline tooltip link — the same source AboutSUsds and other surfaces use.
  const aboutBanner = getBannerById('susds')?.description;

  const details: ProductDetailRow[] = [
    {
      id: 'current-rate',
      icon: <AudioLines className="h-3 w-3" />,
      label: <Trans>Current Rate</Trans>,
      value: currentRate
    },
    {
      id: 'rate-6m',
      icon: <AudioLines className="h-3 w-3" />,
      label: <Trans>6M Rate</Trans>,
      value: sixMonthRate
    },
    {
      id: 'risk',
      icon: <Asterisk className="h-3 w-3" />,
      label: <Trans>Risk scale</Trans>,
      // Mirrors the marketplace's hardcoded tier (earnProducts.ts
      // DEFAULT_RISK_TIER = 'moderate', BL-07) so the table and detail page
      // never diverge for the same product. 🔶 the C3 design meter showed 'low'
      // — confirm with design; updating the registry constant flips both.
      value: <RiskMeter tier="moderate" />
    },
    { id: 'tvl', icon: <Vault className="h-3 w-3" />, label: <Trans>TVL</Trans>, value: tvl },
    {
      id: 'liquidity',
      icon: <Droplet className="h-3 w-3" />,
      label: <Trans>Liquidity</Trans>,
      value: <Trans>Unlimited</Trans>
    },
    {
      id: 'users',
      icon: <UsersRound className="h-3 w-3" />,
      label: <Trans>Users</Trans>,
      value: users
    }
  ];

  return (
    <ProductDetailTemplate
      backHref={ROUTES.EARN}
      token={{
        icon: (
          <TokenIcon token={{ symbol: 'sUSDS' }} width={48} showChainIcon={false} className="h-12 w-12" />
        ),
        brandColor: SUSDS_BRAND_COLOR
      }}
      title={<Trans>Sky Savings</Trans>}
      networkSelector={<ChainModal chainIds={networks} dataTestId="product-detail-network" />}
      chart={<SavingsDetailChart />}
      position={<SavingsPositionCard />}
      details={details}
      about={{
        body: aboutBanner ? parseBannerContent(aboutBanner) : NO_VALUE,
        learnMoreHref: 'https://docs.sky.money'
      }}
      transactions={<SavingsTransactionsTable />}
    />
  );
}
