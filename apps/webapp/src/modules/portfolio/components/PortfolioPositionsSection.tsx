import { ReactNode } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Trans } from '@lingui/react/macro';
import { QueryParams } from '@/lib/constants';
import { ROUTES } from '@/lib/routes';
import { retainOnNavigate } from '@/lib/navigation';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext
} from '@/components/ui/carousel';
import { Text } from '@/modules/layout/components/Typography';
import { usePortfolioSupplyActions } from '../hooks/usePortfolioSupplyActions';
import type { SuppliedView } from '../helpers/suppliedView';
import type { IdleSupplyInfo, IdleView } from '../helpers/idleView';
import { PositionCard } from './PositionCard';
import { IdleStablecoinsTable } from './IdleStablecoinsTable';
import { PortfolioTabs, type PortfolioTab } from './PortfolioTabs';

// Each card spans a fraction of the row so 1 (mobile) → 4 (xl) show at once.
const ITEM_BASIS = 'basis-full sm:basis-1/2 desktop:basis-1/3';
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
  // Products with an in-place supply modal (savings today) open it without
  // navigating; everything else — and all Manage buttons — route to the product page.
  const resolveSupplyAction = usePortfolioSupplyActions();
  const goToProduct = (detailPath: string) =>
    void navigate({ to: detailPath as '/', search: retainOnNavigate });
  // Deep-link to the Earn list pre-filtered by the chosen stablecoin (keeps the
  // active network), consumed by EarnPage's ?token= handler.
  const goToEarnForToken = (symbol: string) =>
    void navigate({
      to: ROUTES.EARN,
      search: prev => ({ ...retainOnNavigate(prev), [QueryParams.Token]: symbol })
    });

  if (tab === 'idle') {
    return (
      <section data-testid="portfolio-positions">
        <PortfolioTabs tab={tab} onTabChange={onTabChange} />
        {idleLoading && idleView.tokens.length === 0 ? (
          <TableSkeleton />
        ) : idleView.tokens.length === 0 ? (
          <EmptyState>
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
          <EmptyState>
            <Trans>No supplied positions yet.</Trans>
          </EmptyState>
        )}
      </section>
    );
  }

  return (
    <section data-testid="portfolio-positions">
      <Carousel opts={{ align: 'start', slidesToScroll: 'auto', containScroll: 'trimSnaps' }}>
        <div className="mb-6 flex items-center justify-between">
          <PortfolioTabs tab={tab} onTabChange={onTabChange} />
          <div className="flex gap-2">
            <CarouselPrevious className={INLINE_ARROW} />
            <CarouselNext className={INLINE_ARROW} />
          </div>
        </div>
        <CarouselContent>
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

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="mt-6 flex min-h-[180px] items-center justify-center">
      <Text variant="medium" className="text-textSecondary">
        {children}
      </Text>
    </div>
  );
}

function CarouselSkeleton() {
  return (
    <div className="mt-6 flex gap-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className={`bg-surface h-[280px] shrink-0 grow-0 animate-pulse rounded-3xl ${ITEM_BASIS}`}
        />
      ))}
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="bg-container mt-6 flex animate-pulse flex-col gap-4 rounded-3xl border p-6">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="bg-surface h-12 rounded-xl" />
      ))}
    </div>
  );
}
