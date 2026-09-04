import { useMemo } from 'react';
import { formatUnits } from 'viem';
import { Trans } from '@lingui/react/macro';
import { RateInfo } from '@/components/product/RateInfo';
import { AudioLines, Asterisk, Vault, UsersRound, Coins } from 'lucide-react';
import { ROUTES } from '@/lib/routes';
import { Intent } from '@/lib/enums';
import {
  rewardsRiskProfile,
  TOKENS,
  trailingAverageRate,
  type RewardContract,
  useProductNetworks,
  useRewardContractInfo,
  useRewardsChartInfo
} from '@/hooks';
import { formatDecimalPercentage, formatNumber } from '@/utils';
import { parseBannerContent } from '@/utils/bannerContentParser';
import { getBannerById } from '@/data/banners/banners';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { NetworkSelect } from '@/modules/ui/components/NetworkSelect';
import { RiskTierDetailsTrigger } from '@/components/product/RiskTierDetails';
import {
  ProductDetailTemplate,
  ProductDetailRow,
  DetailValue
} from '@/components/product/ProductDetailTemplate';
import { rewardContractDisplayName } from '../helpers/rewardContractDisplayName';
import { RewardsDetailChart } from './RewardsDetailChart';
import { RewardsPositionCard } from './RewardsPositionCard';
import { RewardsTransactionsTable } from './RewardsTransactionsTable';
import { NO_VALUE, USER_RISKS_URL } from '@/lib/constants';

/**
 * About-slot content per farm. SPK, GROVE and the (deprecated) SKY farm read
 * the corpus-fed banners (sync pipeline); Chronicle has no corpus entry yet, so
 * its body carries the same third-party disclaimer `AboutCle` shows elsewhere.
 * Every farm's "Learn more" points at the User Risk Documentation (APP-526).
 * TODO(corpus): move the Chronicle copy into the banners pipeline.
 */
function aboutForContract(contract: RewardContract): { body: React.ReactNode; learnMoreHref: string } {
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
      learnMoreHref: USER_RISKS_URL
    };
  }
  const bannerId =
    symbol === TOKENS.spk.symbol
      ? 'about-the-spk-token'
      : symbol === TOKENS.grove.symbol
        ? 'about-the-grove-token'
        : symbol === TOKENS.sky.symbol
          ? 'sky'
          : 'about-sky-token-rewards';
  const banner = getBannerById(bannerId)?.description;
  return {
    body: banner ? parseBannerContent(banner) : NO_VALUE,
    learnMoreHref: USER_RISKS_URL
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
  const networks = useProductNetworks(Intent.REWARDS_INTENT);

  const isPointsFarm = contract.rewardToken.symbol === TOKENS.cle.symbol;
  const rewardSymbol = contract.rewardToken.symbol;

  // One BA Labs series feeds the stat rows (latest entry + 30-day trailing
  // average); the chart fetches its own timeframe-scoped window. TVL comes from
  // the subgraph contract info, matching the legacy statistics section.
  const { data: chartInfo, isLoading: chartLoading } = useRewardsChartInfo({
    rewardContractAddress: contract.contractAddress
  });
  const { data: contractInfo, isLoading: contractInfoLoading } = useRewardContractInfo({
    chainId: contract.chainId,
    rewardContractAddress: contract.contractAddress
  });

  const { latest, thirtyDayRate } = useMemo(() => {
    const sorted = [...(chartInfo ?? [])].sort((a, b) => b.blockTimestamp - a.blockTimestamp);
    return {
      latest: sorted[0],
      // Shared with the marketplace table's 30D Rate column, so the row and
      // this page always report the same figure.
      thirtyDayRate: trailingAverageRate(
        sorted.map(item => ({ rate: parseFloat(item.rate), timestampSec: item.blockTimestamp }))
      )
    };
  }, [chartInfo]);

  // Rate is a decimal fraction; zero means "no live rate" (Chronicle, the
  // deprecated SKY farm) and renders as "–" everywhere.
  const rateValue = latest && parseFloat(latest.rate) > 0 ? parseFloat(latest.rate) : undefined;
  const currentRate = (
    <DetailValue
      loading={chartLoading}
      value={rateValue !== undefined ? formatDecimalPercentage(rateValue) : undefined}
    />
  );
  const formattedThirtyDayRate = (
    <DetailValue
      loading={chartLoading}
      value={
        thirtyDayRate !== undefined && thirtyDayRate > 0 ? formatDecimalPercentage(thirtyDayRate) : undefined
      }
    />
  );

  const tvl = (
    <DetailValue
      loading={contractInfoLoading}
      value={
        contractInfo?.totalSupplied
          ? `$${formatNumber(parseFloat(formatUnits(contractInfo.totalSupplied, 18)))}`
          : undefined
      }
    />
  );
  const suppliers = (
    <DetailValue
      loading={chartLoading}
      value={latest?.suppliers !== undefined ? formatNumber(latest.suppliers) : undefined}
    />
  );
  const totalRewarded = (
    <DetailValue
      loading={chartLoading}
      value={
        latest?.totalRewarded
          ? `${formatNumber(parseFloat(latest.totalRewarded), { compact: true })} ${rewardSymbol}`
          : undefined
      }
    />
  );

  const details: ProductDetailRow[] = [
    {
      id: 'current-rate',
      icon: <AudioLines className="h-3 w-3" />,
      label: <Trans>Current Rate</Trans>,
      info: <RateInfo type="str" size={12} />,
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
      // Each farm resolves its own profile (SKY/SPK/GROVE/Chronicle copy differ)
      // through the same registry the marketplace uses, so they can't diverge.
      value: <RiskTierDetailsTrigger profile={rewardsRiskProfile(contract.rewardToken.symbol)} />
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
      networkSelector={
        <NetworkSelect
          chainIds={networks}
          labelClassName="hidden sm:block"
          dataTestId="product-detail-network"
        />
      }
      chart={<RewardsDetailChart contract={contract} currentRate={rateValue} />}
      position={<RewardsPositionCard contract={contract} isPointsFarm={isPointsFarm} rate={rateValue} />}
      details={details}
      about={aboutForContract(contract)}
      transactions={<RewardsTransactionsTable contract={contract} />}
    />
  );
}
