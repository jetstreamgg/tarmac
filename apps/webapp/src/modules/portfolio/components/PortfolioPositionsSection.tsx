import { useNavigate } from '@tanstack/react-router';
import { Trans } from '@lingui/react/macro';
import { QueryParams } from '@/lib/constants';
import { EARN_OPPORTUNITIES_HASH, ROUTES } from '@/lib/routes';
import { retainOnNavigate } from '@/lib/navigation';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext
} from '@/components/ui/carousel';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { SuppliedEmpty } from '@/modules/icons';
import { usePortfolioSupplyActions } from '../hooks/usePortfolioSupplyActions';
import type { SuppliedView } from '../helpers/suppliedView';
import type { IdleSupplyInfo, IdleView } from '../helpers/idleView';
import { PositionCard } from './PositionCard';
import { IdleStablecoinsTable } from './IdleStablecoinsTable';
import { PortfolioTabs, type PortfolioTab } from './PortfolioTabs';

// Each card spans a fraction of the row so 1 (mobile) → 3 (desktop) show at once.
// The comp (1030:58713) sets cards 8px apart, not the carousel's default 16.
const ITEM_BASIS = 'basis-full pl-2 sm:basis-1/2 desktop:basis-1/3';
// Neutralizes CarouselPrevious/Next's default absolute positioning so the
// arrows sit inline in the section header instead of flanking the row.
const INLINE_ARROW = 'static left-auto right-auto top-auto translate-y-0';

/**
 * The Portfolio positions section below the earnings card. Shares the
 * Supplied/Idle toggle state with the earnings card: Supplied renders an
 * arrow-paged carousel of position cards; Idle renders a table of held
 * stablecoins with a Supply CTA into the Earn list.
 */
export function PortfolioPositionsSection({
  suppliedView,
  suppliedLoading,
  idleView,
  idleSupplyInfo,
  idleLoading,
  tab,
  onTabChange
}: {
  suppliedView: SuppliedView;
  suppliedLoading: boolean;
  idleView: IdleView;
  idleSupplyInfo: Map<string, IdleSupplyInfo>;
  idleLoading: boolean;
  tab: PortfolioTab;
  onTabChange: (tab: PortfolioTab) => void;
}) {
  const navigate = useNavigate();
  // Products with an in-place supply modal open it without navigating —
  // switching the wallet to the position's chain first when needed; products
  // without one — and all Manage buttons — route to the product page.
  const resolveSupplyAction = usePortfolioSupplyActions();
  const goToProduct = (detailPath: string) =>
    void navigate({ to: detailPath as '/', search: retainOnNavigate });
  // Deep-link to the Earn list pre-filtered by the chosen stablecoin (keeps
  // the active network); the anchor lands it past the hero, at the
  // opportunities table (APP-487).
  const goToEarnForToken = (symbol: string) =>
    void navigate({
      to: ROUTES.EARN,
      search: prev => ({ ...retainOnNavigate(prev), [QueryParams.Token]: symbol }),
      hash: EARN_OPPORTUNITIES_HASH
    });

  if (tab === 'idle') {
    return (
      <section data-testid="portfolio-positions">
        <PortfolioTabs tab={tab} onTabChange={onTabChange} />
        {idleLoading && idleView.tokens.length === 0 ? (
          <TableSkeleton />
        ) : idleView.tokens.length === 0 ? (
          <EmptyState className="mt-8" illustration={<SuppliedEmpty aria-hidden />}>
            <Trans>No idle stablecoins.</Trans>
          </EmptyState>
        ) : (
          <IdleStablecoinsTable
            tokens={idleView.tokens}
            supplyInfo={idleSupplyInfo}
            onSupply={goToEarnForToken}
          />
        )}
      </section>
    );
  }

  if (suppliedView.positions.length === 0) {
    return (
      <section data-testid="portfolio-positions">
        <PortfolioTabs tab={tab} onTabChange={onTabChange} />
        {suppliedLoading ? (
          <CarouselSkeleton />
        ) : (
          <EmptyState className="mt-8" illustration={<SuppliedEmpty aria-hidden />}>
            <Trans>No supplied positions yet.</Trans>
          </EmptyState>
        )}
      </section>
    );
  }

  return (
    <section data-testid="portfolio-positions">
      <Carousel opts={{ align: 'start', slidesToScroll: 'auto', containScroll: 'trimSnaps' }}>
        <div className="mb-8 flex items-center justify-between">
          <PortfolioTabs tab={tab} onTabChange={onTabChange} />
          {/* DS Button / Icon pair, secondary at 32px with a 12px glyph and
              6px between them (1030:58710, APP-443 item 8) — they were the
              legacy `outline` icon button, whose border all but vanished in
              light mode. */}
          <div className="flex gap-1.5">
            <CarouselPrevious variant="secondary" size="iconS" className={INLINE_ARROW} />
            <CarouselNext variant="secondary" size="iconS" className={INLINE_ARROW} />
          </div>
        </div>
        <CarouselContent className="-ml-2">
          {suppliedView.positions.map(position => (
            <CarouselItem key={position.id} className={ITEM_BASIS}>
              <PositionCard
                position={position}
                onSupply={resolveSupplyAction(position) ?? (() => goToProduct(position.detailPath))}
                onManage={() => goToProduct(position.detailPath)}
              />
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
    </section>
  );
}

// Skeleton placeholders sized like the loaded cards: an exact-fit grid showing
// as many cards as the carousel does per tier (1 → 2 → 3), no clipped extras.
function CarouselSkeleton() {
  return (
    <div className="desktop:grid-cols-3 mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Skeleton className="h-[280px] rounded-[28px]" />
      <Skeleton className="hidden h-[280px] rounded-[28px] sm:block" />
      <Skeleton className="desktop:block hidden h-[280px] rounded-[28px]" />
    </div>
  );
}

function TableSkeleton() {
  return (
    <Card className="mt-8 flex flex-col gap-4 p-6">
      {Array.from({ length: 3 }).map((_, index) => (
        <Skeleton key={index} className="h-12 rounded-xl" />
      ))}
    </Card>
  );
}
