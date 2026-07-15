import { useMemo } from 'react';
import { useChains } from 'wagmi';
import { format } from 'date-fns';
import { Trans } from '@lingui/react/macro';
import { AudioLines, Asterisk, Calendar, Vault, Droplet } from 'lucide-react';
import { ROUTES } from '@/lib/routes';
import { Intent } from '@/lib/enums';
import { productNetworks, usePendleMarketsApiData, type PendleMarketConfig } from '@/hooks';
import { formatDecimalPercentage, formatNumber } from '@/utils';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { ChainModal } from '@/modules/ui/components/ChainModal';
import { HeaderBadge } from '@/components/ui/page-header';
import { RiskTierMeter } from '@/components/product/RiskMeter';
import { ProductDetailTemplate, ProductDetailRow } from '@/components/product/ProductDetailTemplate';
import { PendleDetailChart } from './PendleDetailChart';
import { PendlePositionCard } from './PendlePositionCard';
import { PendleTransactionsTable } from './PendleTransactionsTable';
import { PendleMaturityProgress } from './PendleMaturityProgress';
import { PendleAboutContent } from './PendleAboutContent';
import { formatTimeLeft } from '../utils/formatTimeLeft';

const NO_VALUE = '–';
const SECONDS_PER_DAY = 86_400;

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
  const chains = useChains();
  const networks = useMemo(
    () =>
      productNetworks(
        Intent.FIXED_INTENT,
        chains.map(chain => chain.id)
      ),
    [chains]
  );

  const { data: marketsApi } = usePendleMarketsApiData();
  const stats = marketsApi?.[market.marketAddress];

  const expirySec = stats?.expirySec ?? market.expiry;
  const remainingSeconds = Math.max(0, expirySec - Math.floor(Date.now() / 1000));
  const remainingDays = Math.floor(remainingSeconds / SECONDS_PER_DAY);
  const maturityDateLabel = format(new Date(expirySec * 1000), 'd MMM yyyy');

  const details: ProductDetailRow[] = [
    {
      id: 'fixed-apy',
      icon: <AudioLines className="h-3 w-3" />,
      label: <Trans>Fixed APY</Trans>,
      value: stats?.impliedApy !== undefined ? formatDecimalPercentage(stats.impliedApy) : NO_VALUE
    },
    {
      id: 'underlying-apy',
      icon: <AudioLines className="h-3 w-3" />,
      label: <Trans>Underlying APY</Trans>,
      value: stats?.underlyingApy !== undefined ? formatDecimalPercentage(stats.underlyingApy) : NO_VALUE
    },
    {
      id: 'risk',
      icon: <Asterisk className="h-3 w-3" />,
      label: <Trans>Risk profile</Trans>,
      // Mirrors the marketplace's hardcoded tier (earnProducts.ts
      // DEFAULT_RISK_TIER, BL-07) so the table and detail page never diverge.
      value: <RiskTierMeter tier="moderate" />
    },
    {
      id: 'maturity',
      icon: <Calendar className="h-3 w-3" />,
      label: <Trans>Maturity</Trans>,
      value: (
        <span>
          {maturityDateLabel}{' '}
          <span className="text-textSecondary">
            <Trans>({remainingDays} days)</Trans>
          </span>
        </span>
      )
    },
    {
      id: 'tvl',
      icon: <Vault className="h-3 w-3" />,
      label: <Trans>TVL</Trans>,
      value: stats?.tvl !== undefined ? `$${formatNumber(stats.tvl, { compact: true })}` : NO_VALUE
    },
    {
      id: 'liquidity',
      icon: <Droplet className="h-3 w-3" />,
      label: <Trans>Liquidity</Trans>,
      value:
        stats?.liquidity !== undefined ? `$${formatNumber(stats.liquidity, { maxDecimals: 0 })}` : NO_VALUE
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
        )
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
        <ChainModal
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
