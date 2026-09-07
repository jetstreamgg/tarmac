import { Trans } from '@lingui/react/macro';
import { RateInfo } from '@/components/product/RateInfo';
import { AudioLines, Asterisk, Calendar, Vault, Droplet } from 'lucide-react';
import { ROUTES } from '@/lib/routes';
import { Intent } from '@/lib/enums';
import { type PendleMarketConfig, usePendleMarketsApiData, useProductNetworks } from '@/hooks';
import { formatDecimalPercentage, formatNumber } from '@/utils';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { NetworkSelect } from '@/modules/ui/components/NetworkSelect';
import { HeaderBadge } from '@/components/ui/page-header';
import { RiskTierDetailsTrigger } from '@/components/product/RiskTierDetails';
import {
  ProductDetailTemplate,
  ProductDetailRow,
  DetailValue
} from '@/components/product/ProductDetailTemplate';
import { PendleDetailChart } from './PendleDetailChart';
import { PendlePositionCard } from './PendlePositionCard';
import { PendleTransactionsTable } from './PendleTransactionsTable';
import { PendleMaturityProgress } from './PendleMaturityProgress';
import { PendleAboutContent } from './PendleAboutContent';
import { formatTimeLeft } from '../utils/formatTimeLeft';
import { formatMaturity } from '@/modules/earn/helpers/formatMaturity';
import { remainingDaysToMaturity } from '@/modules/earn/helpers/daysToMaturity';

export type PendleProductDetailProps = {
  market: PendleMarketConfig;
};

/**
 * Pendle market detail page (E1) — composes the reusable ProductDetailTemplate,
 * mirroring SavingsProductDetail/VaultProductDetail. Serves every live market
 * at /earn/fixed/:slug (PT-sUSDS is the design proof, Figma 486:33806/33942);
 * the $slug route resolves the slug and guards maturity before mounting this.
 */
export function PendleProductDetail({ market }: PendleProductDetailProps) {
  const networks = useProductNetworks(Intent.FIXED_INTENT);

  const { data: marketsApi, isLoading: statsLoading } = usePendleMarketsApiData();
  const stats = marketsApi?.[market.marketAddress];

  const expirySec = stats?.expirySec ?? market.expiry;
  // One instant for both, so the countdown and the day count can't straddle a
  // second boundary and disagree.
  const nowMs = Date.now();
  const remainingSeconds = Math.max(0, expirySec - Math.floor(nowMs / 1000));
  const remainingDays = remainingDaysToMaturity(expirySec, nowMs);
  const maturityDateLabel = formatMaturity(expirySec);

  const details: ProductDetailRow[] = [
    {
      id: 'fixed-apy',
      icon: <AudioLines className="h-3 w-3" />,
      label: <Trans>Fixed APY</Trans>,
      info: <RateInfo type="fixedYield" size={12} />,
      value: (
        <DetailValue
          loading={statsLoading}
          value={stats?.impliedApy !== undefined ? formatDecimalPercentage(stats.impliedApy) : undefined}
        />
      )
    },
    {
      id: 'underlying-apy',
      icon: <AudioLines className="h-3 w-3" />,
      label: <Trans>Underlying APY</Trans>,
      value: (
        <DetailValue
          loading={statsLoading}
          value={
            stats?.underlyingApy !== undefined ? formatDecimalPercentage(stats.underlyingApy) : undefined
          }
        />
      )
    },
    {
      id: 'risk',
      icon: <Asterisk className="h-3 w-3" />,
      label: <Trans>Risk profile</Trans>,
      // Tier + copy resolve through the profile registry (RISK_TIER_BY_PROFILE,
      // BL-07), so the marketplace and this page can't diverge.
      value: <RiskTierDetailsTrigger profile="fixed" />
    },
    {
      id: 'maturity',
      icon: <Calendar className="h-3 w-3" />,
      label: <Trans>Maturity</Trans>,
      value: (
        <span>
          {maturityDateLabel}{' '}
          <span className="text-textSecondary">
            {/* The day count floors, so the last stretch before expiry lands on
                0 — stated as "less than a day", since "(0 days)" would claim the
                market matures today, and a matured one already reads
                "(Matured)". One day gets its own branch so the plural never
                reads "1 days", matching FixedYieldTerm. */}
            {remainingSeconds <= 0 ? (
              <Trans>(Matured)</Trans>
            ) : remainingDays === 0 ? (
              <Trans>(less than a day)</Trans>
            ) : remainingDays === 1 ? (
              <Trans>(1 day)</Trans>
            ) : (
              <Trans>({remainingDays} days)</Trans>
            )}
          </span>
        </span>
      )
    },
    {
      id: 'tvl',
      icon: <Vault className="h-3 w-3" />,
      label: <Trans>TVL</Trans>,
      value: (
        <DetailValue
          loading={statsLoading}
          value={stats?.tvl !== undefined ? `$${formatNumber(stats.tvl, { maxDecimals: 0 })}` : undefined}
        />
      )
    },
    {
      id: 'liquidity',
      icon: <Droplet className="h-3 w-3" />,
      label: <Trans>AMM liquidity</Trans>,
      value: (
        <DetailValue
          loading={statsLoading}
          value={
            stats?.liquidity !== undefined
              ? `$${formatNumber(stats.liquidity, { maxDecimals: 0 })}`
              : undefined
          }
        />
      )
    }
  ];

  return (
    <ProductDetailTemplate
      backHref={ROUTES.EARN}
      token={{
        icon: (
          <TokenIcon
            token={{ symbol: `PT-${market.underlyingSymbol}` }}
            width={48}
            className="h-12 w-12"
            showChainIcon={false}
          />
        ),
        status: 'success'
      }}
      title={
        <span className="flex flex-col gap-1">
          <span className="flex flex-wrap items-center gap-2">
            {market.name}
            {/* Brand-colored mark from the design system (a bitmap in Figma too) —
                the monochrome <Pendle /> glyph reads wrong at badge size. */}
            <HeaderBadge size="s" icon={<img src="/images/pendle_logo.png" alt="" className="size-4" />}>
              <Trans>Powered by Pendle</Trans>
            </HeaderBadge>
          </span>
          {/* The DS date line under the title (5120:19542) is Body 6, so it
              opts back out of the heading's Circular styling. */}
          <span className="font-graphik text-fgSecondary text-xs leading-[18px] font-normal tracking-normal">
            {maturityDateLabel}
            {remainingSeconds > 0 && <> · {formatTimeLeft(remainingSeconds)}</>}
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
      chart={<PendleDetailChart market={market} />}
      position={<PendlePositionCard market={market} />}
      details={details}
      afterDetails={{ title: <Trans>Maturity</Trans>, body: <PendleMaturityProgress market={market} /> }}
      about={{ body: <PendleAboutContent market={market} /> }}
      transactions={<PendleTransactionsTable market={market} />}
      transactionsTitle={<Trans>All transactions</Trans>}
    />
  );
}
