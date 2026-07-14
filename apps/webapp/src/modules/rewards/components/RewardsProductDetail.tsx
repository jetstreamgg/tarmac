import { useMemo } from 'react';
import { useChains } from 'wagmi';
import { formatUnits } from 'viem';
import { Trans } from '@lingui/react/macro';
import { AudioLines, Asterisk, Vault, UsersRound, Coins } from 'lucide-react';
import { ROUTES } from '@/lib/routes';
import { Intent } from '@/lib/enums';
import {
  TOKENS,
  productNetworks,
  useRewardContractInfo,
  useRewardsChartInfo,
  type RewardContract
} from '@/hooks';
import { formatDecimalPercentage, formatNumber } from '@/utils';
import { parseBannerContent } from '@/utils/bannerContentParser';
import { getBannerById } from '@/data/banners/banners';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { ChainModal } from '@/modules/ui/components/ChainModal';
import { RiskTierMeter } from '@/components/product/RiskMeter';
import { ProductDetailTemplate, ProductDetailRow } from '@/components/product/ProductDetailTemplate';
import { rewardContractDisplayName } from '../helpers/rewardContractDisplayName';
import { RewardsDetailChart } from './RewardsDetailChart';
import { RewardsPositionCard } from './RewardsPositionCard';
import { RewardsTransactionsTable } from './RewardsTransactionsTable';

const NO_VALUE = '–';

/**
 * About-slot content per farm. SPK and the (deprecated) SKY farm read the
 * corpus-fed banners (sync pipeline); Chronicle has no corpus entry yet, so its
 * body carries the same third-party disclaimer `AboutCle` shows elsewhere.
 * TODO(corpus): move the Chronicle copy into the banners pipeline.
 */
function aboutForContract(contract: RewardContract): { body: React.ReactNode; learnMoreHref?: string } {
  const symbol = contract.rewardToken.symbol;
  if (symbol === TOKENS.cle.symbol) {
    return {
      body: (
        <Trans>
          Chronicle Points are not a native feature of the Sky Protocol. Skybase International does not
          control or guarantee the availability, distribution or allocation of Chronicle Points or any other
          Chronicle funds. The Chronicle project operates independently of Sky.money and Skybase
          International. Please be aware that any engagement with Chronicle is at your own risk, and we bear
          no responsibility for any outcomes associated with this third-party system, or any funds associated
          with it.
        </Trans>
      ),
      learnMoreHref: 'https://chroniclelabs.org/'
    };
  }
  const bannerId =
    symbol === TOKENS.spk.symbol
      ? 'about-the-spk-token'
      : symbol === TOKENS.sky.symbol
        ? 'sky'
        : 'about-sky-token-rewards';
  const banner = getBannerById(bannerId)?.description;
  return {
    body: banner ? parseBannerContent(banner) : NO_VALUE,
    learnMoreHref: contract.externalLink
  };
}

/**
 * The rewards product-detail page (`/earn/rewards/$rewardContract`) — a
 * ProductDetailTemplate consumer, one instance per reward farm (SPK, Chronicle,
 * plus the URL-only deprecated SKY farm). Composition mirrors
 * SavingsProductDetail/VaultProductDetail: this page wires the data, the
 * template owns the layout.
 */
export function RewardsProductDetail({ contract }: { contract: RewardContract }) {
  // The networks Rewards is live on among the configured chains (mainnet family
  // only today) — scopes the header's network switcher.
  const chains = useChains();
  const networks = useMemo(
    () =>
      productNetworks(
        Intent.REWARDS_INTENT,
        chains.map(chain => chain.id)
      ),
    [chains]
  );

  const isPointsFarm = contract.rewardToken.symbol === TOKENS.cle.symbol;
  const rewardSymbol = contract.rewardToken.symbol;

  // One BA Labs series feeds the stat rows (latest entry + 30-day trailing
  // average); the chart fetches its own timeframe-scoped window. TVL comes from
  // the subgraph contract info, matching the legacy statistics section.
  const { data: chartInfo } = useRewardsChartInfo({ rewardContractAddress: contract.contractAddress });
  const { data: contractInfo } = useRewardContractInfo({
    chainId: contract.chainId,
    rewardContractAddress: contract.contractAddress
  });

  const { latest, thirtyDayRate } = useMemo(() => {
    const sorted = [...(chartInfo ?? [])].sort((a, b) => b.blockTimestamp - a.blockTimestamp);
    const last30 = sorted.slice(0, 30);
    return {
      latest: sorted[0],
      thirtyDayRate:
        last30.length > 0
          ? last30.reduce((sum, item) => sum + parseFloat(item.rate), 0) / last30.length
          : undefined
    };
  }, [chartInfo]);

  // Rate is a decimal fraction; zero means "no live rate" (Chronicle, the
  // deprecated SKY farm) and renders as "–" everywhere.
  const rateValue = latest && parseFloat(latest.rate) > 0 ? parseFloat(latest.rate) : undefined;
  const currentRate = rateValue !== undefined ? formatDecimalPercentage(rateValue) : NO_VALUE;
  const formattedThirtyDayRate =
    thirtyDayRate !== undefined && thirtyDayRate > 0 ? formatDecimalPercentage(thirtyDayRate) : NO_VALUE;

  const tvl = contractInfo?.totalSupplied
    ? `$${formatNumber(parseFloat(formatUnits(contractInfo.totalSupplied, 18)))}`
    : NO_VALUE;
  const suppliers = latest?.suppliers !== undefined ? formatNumber(latest.suppliers) : NO_VALUE;
  const totalRewarded = latest?.totalRewarded
    ? `${formatNumber(parseFloat(latest.totalRewarded), { compact: true })} ${rewardSymbol}`
    : NO_VALUE;

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
      value: formattedThirtyDayRate
    },
    {
      id: 'risk',
      icon: <Asterisk className="h-3 w-3" />,
      label: <Trans>Risk scale</Trans>,
      // Mirrors the marketplace's hardcoded tier (earnProducts.ts
      // DEFAULT_RISK_TIER = 'moderate', BL-07) so the table and detail page
      // never diverge for the same product.
      value: <RiskTierMeter tier="moderate" />
    },
    { id: 'tvl', icon: <Vault className="h-3 w-3" />, label: <Trans>TVL</Trans>, value: tvl },
    {
      id: 'users',
      icon: <UsersRound className="h-3 w-3" />,
      label: <Trans>Users</Trans>,
      value: suppliers
    },
    {
      id: 'total-rewarded',
      icon: <Coins className="h-3 w-3" />,
      label: isPointsFarm ? <Trans>Total points rewarded</Trans> : <Trans>Total rewarded</Trans>,
      value: totalRewarded
    }
  ];

  return (
    <ProductDetailTemplate
      backHref={ROUTES.EARN}
      token={{
        icon: (
          <TokenIcon
            token={{ symbol: rewardSymbol }}
            width={48}
            className="h-12 w-12"
            showChainIcon={false}
          />
        )
      }}
      title={rewardContractDisplayName(contract)}
      networkSelector={<ChainModal chainIds={networks} dataTestId="product-detail-network" />}
      chart={<RewardsDetailChart contract={contract} currentRate={rateValue} />}
      position={<RewardsPositionCard contract={contract} isPointsFarm={isPointsFarm} rate={rateValue} />}
      details={details}
      about={aboutForContract(contract)}
      transactions={<RewardsTransactionsTable contract={contract} />}
    />
  );
}
