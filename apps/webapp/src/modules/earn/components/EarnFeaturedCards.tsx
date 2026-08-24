import { ReactNode, useState } from 'react';
import { Trans } from '@lingui/react/macro';
import { cn } from '@/lib/cn';
import { BP, useBreakpointIndex, type EarnProductRow } from '@/hooks';
import { getChainIcon } from '@/utils';
import { Button } from '@/components/ui/button';
import { HeaderBadge } from '@/components/ui/page-header';
import { IconboxStatus } from '@/components/ui/iconbox';
import { RiskTierDetailsTrigger } from '@/components/product/RiskTierDetails';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { IconStack } from '@/modules/ui/components/TokenIconStack';
import { Pendle } from '@/widgets';
import { Skeleton } from '@/components/ui/skeleton';
import { formatMaturity } from '../helpers/formatMaturity';
import { formatUsdCompact } from '../helpers/formatUsdCompact';
import { NO_VALUE } from '@/lib/constants';
import { remainingDaysToMaturity } from '../helpers/daysToMaturity';
import { FixedYieldTerm } from './FixedYieldTerm';

/** The row's rate, or an inline skeleton while its source is still loading. */
function RateFigure({ row, className = 'h-4 w-12' }: { row: EarnProductRow; className?: string }) {
  if (row.rate.value === undefined && row.isLoading) {
    return <Skeleton className={cn('inline-block rounded align-baseline', className)} />;
  }
  return <>{row.rate.formatted}</>;
}

/** Render-time context handed to the content hooks of a descriptor. */
type HighlightedProductContext = {
  /** Mount-time clock (kept out of render for react-hooks/purity). */
  now: number;
};

/**
 * Editorial descriptor for one highlighted product: which marketplace row
 * feeds it, whether product wants it shown, and the card content as render
 * hooks over that row. Layout stays with the component — one visible product
 * renders the full-width desktop treatment when `wide` is provided, any other
 * combination the vertical cards.
 */
export type HighlightedProduct = {
  /** Stable key; also the testid suffix (`earn-featured-{id}`). */
  id: string;
  /** The product switch: flip to feature/unfeature without touching markup. */
  visible: boolean;
  findRow: (rows: EarnProductRow[]) => EarnProductRow | undefined;
  badges: (row: EarnProductRow) => ReactNode;
  icon: (row: EarnProductRow) => ReactNode;
  title: (row: EarnProductRow) => ReactNode;
  description: (row: EarnProductRow, context: HighlightedProductContext) => ReactNode;
  stats: (row: EarnProductRow) => ReactNode;
  /** Distinct full-width desktop card (1036:201301), used when this is the only visible product. */
  wide?: (row: EarnProductRow, onSupply: () => void) => ReactNode;
};

/** Badges / Set: the bordered pill around the overlapping network icons (S 16px / M 24px). */
function NetworksBadge({ networks, size = 's' }: { networks: number[]; size?: 's' | 'm' }) {
  return (
    <span
      className={cn(
        'border-glassBorder flex w-fit items-center rounded-full border p-1',
        size === 'm' ? 'h-8' : 'h-6'
      )}
    >
      <IconStack size={size === 'm' ? 24 : 16}>
        {networks.map(id => getChainIcon(id, 'h-full w-full'))}
      </IconStack>
    </span>
  );
}

function Stat({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex h-10 flex-col justify-between md:h-11">
      <span className="text-fgSecondary text-xs leading-[18px]">{label}</span>
      <span className="text-fgPrimary font-circle text-base leading-[18px] font-medium tracking-[-0.32px] md:text-lg md:leading-[22px] md:tracking-[-0.36px]">
        {children}
      </span>
    </div>
  );
}

function StatDivider() {
  return <div className="bg-borderPrimary h-6 w-px shrink-0" />;
}

/** Rate stat label: the mobile comp says "APY" (486:22051), the desktop comps "Rate" (1036:201228). */
function RateLabel() {
  return (
    <>
      <span className="md:hidden">
        <Trans>APY</Trans>
      </span>
      <span className="hidden md:inline">
        <Trans>Rate</Trans>
      </span>
    </>
  );
}

/**
 * The one-card desktop treatment for Sky Savings (1036:201306, 1032×320): 3D
 * coin bleeding off the clipped left edge, badges / headline+blurb / stats
 * spread over the card height, Earn CTA bottom-right. The coin asset is the
 * in-card render chroma-masked to transparency — swap for a source export if
 * design provides the library asset.
 */
function SavingsCardWide({ row, onSupply }: { row: EarnProductRow; onSupply: () => void }) {
  return (
    <article
      className="bg-bgSecondary relative hidden min-h-80 flex-col justify-between overflow-hidden rounded-[28px] py-10 pr-10 pl-60 backdrop-blur-[20px] md:flex"
      data-testid="earn-featured-savings-wide"
    >
      <img
        src="/illustrations/illustration-supply-coins.png"
        alt=""
        className="absolute top-1/2 left-0 h-[254px] w-auto -translate-y-1/2"
      />
      <div className="flex flex-wrap items-center gap-2">
        <HeaderBadge
          icon={
            <TokenIcon token={{ symbol: 'sUSDS' }} width={16} showChainIcon={false} className="h-4 w-4" />
          }
        >
          <Trans>Savings</Trans>
        </HeaderBadge>
        <HeaderBadge
          icon={<TokenIcon token={{ symbol: 'SKY' }} width={16} showChainIcon={false} className="h-4 w-4" />}
        >
          <Trans>Powered by Sky</Trans>
        </HeaderBadge>
        <NetworksBadge networks={row.networks} size="m" />
      </div>
      <div className="flex flex-col gap-2">
        <h3 className="text-fgPrimary font-circle max-w-[671px] text-[32px] leading-[35px] font-medium tracking-[-0.64px]">
          {/* While the rate loads the figure wears the pulsing-pill dress (class
              changes keep the extracted message identical). */}
          <Trans>
            Supply {row.supplyTokens.join('/')} at{' '}
            <span
              className={cn(
                'bg-linear-to-b from-[#949aff] to-[#504dff] bg-clip-text text-transparent',
                row.rate.value === undefined &&
                  row.isLoading &&
                  'bg-surface animate-pulse rounded-lg bg-none bg-clip-border select-none'
              )}
            >
              {row.rate.formatted}
            </span>{' '}
            APY
          </Trans>
        </h3>
        <p className="text-fgSecondary max-w-[479px] text-xs leading-[18px]">
          <Trans>
            Governed by Sky Ecosystem to deliver the best risk-adjusted yield, sUSDS allows you to grow your
            holdings with instant liquidity and zero fees.
          </Trans>
        </p>
      </div>
      <div className="flex items-end justify-between">
        <div className="flex items-center gap-8">
          <div className="flex flex-col gap-1">
            <span className="text-fgSecondary text-xs leading-[18px]">
              <Trans>TVL</Trans>
            </span>
            <span className="text-fgPrimary font-circle text-lg leading-[22px] font-medium tracking-[-0.36px]">
              {row.tvl ? (
                formatUsdCompact(row.tvl.totalUsd)
              ) : row.isLoading ? (
                <Skeleton className="h-5 w-16 rounded" />
              ) : (
                NO_VALUE
              )}
            </span>
          </div>
          <div className="bg-borderPrimary h-8 w-px shrink-0" />
          <div className="flex flex-col gap-1.5">
            <span className="text-fgSecondary text-xs leading-[18px]">
              <Trans>Risk</Trans>
            </span>
            <RiskTierDetailsTrigger profile={row.riskProfile} />
          </div>
        </div>
        <Button variant="primary" size="l" className="w-28" onClick={onSupply}>
          <Trans>Earn</Trans>
        </Button>
      </div>
    </article>
  );
}

/**
 * The data source for the /earn hero band (APP-395): one descriptor per
 * highlightable product. Which products show — and therefore whether the band
 * renders one card (full-width on desktop) or two (stacked / side-by-side) —
 * is just the `visible` flags; adding a product is a new entry, not new
 * markup. Live numbers always come from the matched marketplace row.
 */
export const HIGHLIGHTED_PRODUCTS: HighlightedProduct[] = [
  {
    id: 'savings',
    visible: true,
    findRow: rows => rows.find(row => row.id === 'savings'),
    badges: row => (
      <>
        <HeaderBadge
          size="s"
          icon={<TokenIcon token={{ symbol: 'SKY' }} width={16} showChainIcon={false} className="h-4 w-4" />}
        >
          <Trans>Powered by Sky</Trans>
        </HeaderBadge>
        <NetworksBadge networks={row.networks} />
      </>
    ),
    icon: row => (
      <IconboxStatus size="l" className="size-14 md:size-16">
        <TokenIcon
          token={{ symbol: row.tokenSymbol }}
          width={48}
          showChainIcon={false}
          className="h-11 w-11 md:h-12 md:w-12"
        />
      </IconboxStatus>
    ),
    title: () => <Trans>Sky Savings</Trans>,
    description: () => (
      <Trans>
        Governed by Sky Ecosystem to deliver the best risk-adjusted yield, sUSDS allows you to grow your
        holdings with instant liquidity and zero fees.
      </Trans>
    ),
    stats: row => (
      <>
        <Stat label={<RateLabel />}>
          <RateFigure row={row} />
        </Stat>
        <StatDivider />
        <Stat label={<Trans>Risk</Trans>}>
          <RiskTierDetailsTrigger profile={row.riskProfile} />
        </Stat>
      </>
    ),
    wide: (row, onSupply) => <SavingsCardWide row={row} onSupply={onSupply} />
  },
  {
    id: 'fixed',
    visible: true,
    findRow: rows => rows.find(row => row.kind === 'fixed'),
    badges: row => (
      <>
        <HeaderBadge size="s" className="md:text-fgSecondary px-2">
          <Trans>Fixed yield</Trans>
        </HeaderBadge>
        <HeaderBadge size="s" icon={<Pendle className="h-4 w-4" />}>
          <Trans>Powered by Pendle</Trans>
        </HeaderBadge>
        <NetworksBadge networks={row.networks} />
      </>
    ),
    icon: row => (
      <IconboxStatus size="l" type="success" dot className="size-14 md:size-16">
        <TokenIcon
          token={{ symbol: row.tokenSymbol }}
          width={48}
          showChainIcon={false}
          className="h-11 w-11 md:h-12 md:w-12"
        />
      </IconboxStatus>
    ),
    title: row => row.name,
    description: (row, { now }) => {
      const days = row.maturity ? remainingDaysToMaturity(row.maturity, now) : undefined;
      return (
        <>
          <Trans>
            Fixed yield markets let you supply USDS and walk away with a guaranteed return at the market
            maturity.
          </Trans>{' '}
          <FixedYieldTerm rate={row.rate.formatted} days={days} />
        </>
      );
    },
    stats: row => (
      <>
        <Stat label={<RateLabel />}>
          <RateFigure row={row} />
        </Stat>
        <StatDivider />
        {row.maturity && (
          <>
            <Stat label={<Trans>Maturity date</Trans>}>{formatMaturity(row.maturity)}</Stat>
            <StatDivider />
          </>
        )}
        <Stat label={<Trans>Risk</Trans>}>
          <RiskTierDetailsTrigger profile={row.riskProfile} />
        </Stat>
      </>
    )
  }
];

/**
 * The vertical card anatomy — stacked on mobile (486:22051), side-by-side
 * two-up on desktop (1036:201228: 32px padding, 64px icon left of the badges,
 * Heading 5 title, Label 3 stat values, inline 112×48 Earn CTA).
 */
function FeaturedCard({
  product,
  row,
  context,
  onSupply
}: {
  product: HighlightedProduct;
  row: EarnProductRow;
  context: HighlightedProductContext;
  onSupply: () => void;
}) {
  return (
    <article
      className="bg-bgSecondary flex flex-col rounded-[28px] p-5 backdrop-blur-[20px] md:p-8"
      data-testid={`earn-featured-${product.id}`}
    >
      <div className="flex flex-col md:flex-row-reverse md:items-start md:justify-between">
        <div className="flex flex-wrap items-center gap-2">{product.badges(row)}</div>
        <div className="mt-6 md:mt-0">{product.icon(row)}</div>
      </div>
      <h3 className="text-fgPrimary font-circle mt-5 text-xl leading-[22px] font-medium tracking-[-0.4px] md:mt-10 md:text-2xl md:leading-[26px] md:tracking-[-0.48px]">
        {product.title(row)}
      </h3>
      <p className="text-fgSecondary mt-2 text-xs leading-[18px] md:max-w-[370px]">
        {product.description(row, context)}
      </p>
      <div className="mt-8 flex flex-1 items-end justify-between gap-6 md:mt-10">
        <div className="flex items-center gap-6">{product.stats(row)}</div>
        <Button variant="primary" size="l" className="hidden w-28 md:inline-flex" onClick={onSupply}>
          <Trans>Earn</Trans>
        </Button>
      </div>
      <Button variant="primary" size="m" className="mt-5 w-full md:hidden" onClick={onSupply}>
        <Trans>Supply</Trans>
      </Button>
    </article>
  );
}

/**
 * The highlighted product cards of the /earn hero band, driven by the
 * `HIGHLIGHTED_PRODUCTS` descriptors (overridable per render for
 * tests/previews). One visible product with a `wide` treatment renders it
 * full-width on desktop; anything else renders the vertical cards — stacked
 * below md, a two-up grid from md.
 */
export function EarnFeaturedCards({
  rows,
  onSelect,
  products = HIGHLIGHTED_PRODUCTS
}: {
  rows: EarnProductRow[];
  onSelect: (id: string) => void;
  products?: HighlightedProduct[];
}) {
  const { bpi } = useBreakpointIndex();
  const isMobile = bpi < BP.md;
  // Mount-time clock for the maturity countdown — day granularity, so a stale
  // "now" within a session is fine, and the initializer keeps render pure.
  const [now] = useState(() => Date.now());
  const context: HighlightedProductContext = { now };

  const visible = products
    .filter(product => product.visible)
    .map(product => ({ product, row: product.findRow(rows) }))
    .filter((entry): entry is { product: HighlightedProduct; row: EarnProductRow } => !!entry.row);

  if (visible.length === 0) return null;

  const [first] = visible;
  if (visible.length === 1 && !isMobile && first.product.wide) {
    return (
      <div className="flex flex-col" data-testid="earn-featured-cards">
        {first.product.wide(first.row, () => onSelect(first.row.id))}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex flex-col gap-3',
        visible.length > 1 && 'md:grid md:grid-cols-2 md:items-stretch md:gap-4'
      )}
      data-testid="earn-featured-cards"
    >
      {visible.map(({ product, row }) => (
        <FeaturedCard
          key={product.id}
          product={product}
          row={row}
          context={context}
          onSupply={() => onSelect(row.id)}
        />
      ))}
    </div>
  );
}
