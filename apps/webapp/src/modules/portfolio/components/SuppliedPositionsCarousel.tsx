import { useNavigate } from '@tanstack/react-router';
import { Trans } from '@lingui/react/macro';
import { retainOnNavigate } from '@/lib/navigation';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext
} from '@/components/ui/carousel';
import { Text } from '@/modules/layout/components/Typography';
import type { SuppliedView } from '../helpers/suppliedView';
import { PositionCard } from './PositionCard';
import { PortfolioTabs, type PortfolioTab } from './PortfolioTabs';

// Each card spans a fraction of the row so 1 (mobile) → 4 (xl) show at once.
const ITEM_BASIS = 'basis-full sm:basis-1/2 lg:basis-1/3 xl:basis-1/4';
// Neutralizes CarouselPrevious/Next's default absolute positioning so the
// arrows sit inline in the section header instead of flanking the row.
const INLINE_ARROW = 'static left-auto right-auto top-auto translate-y-0';

/**
 * The Portfolio "Supplied" positions, one card per position (already sorted
 * highest-amount-first by buildSuppliedView), in a horizontal arrow-paged
 * carousel. Shares the Supplied/Idle toggle state with the earnings card.
 */
export function SuppliedPositionsCarousel({
  view,
  isLoading,
  tab,
  onTabChange
}: {
  view: SuppliedView;
  isLoading: boolean;
  tab: PortfolioTab;
  onTabChange: (tab: PortfolioTab) => void;
}) {
  const navigate = useNavigate();
  const goToProduct = (detailPath: string) =>
    void navigate({ to: detailPath as '/', search: retainOnNavigate });

  const showSkeleton = isLoading && view.positions.length === 0;

  if (tab === 'idle' || view.positions.length === 0) {
    return (
      <section data-testid="supplied-positions">
        <PortfolioTabs tab={tab} onTabChange={onTabChange} />
        {tab === 'idle' ? (
          <ComingSoon />
        ) : showSkeleton ? (
          <CarouselSkeleton />
        ) : (
          <div className="mt-6 flex min-h-[180px] items-center justify-center">
            <Text variant="medium" className="text-textSecondary">
              <Trans>No supplied positions yet.</Trans>
            </Text>
          </div>
        )}
      </section>
    );
  }

  return (
    <section data-testid="supplied-positions">
      <Carousel opts={{ align: 'start', slidesToScroll: 'auto', containScroll: 'trimSnaps' }}>
        <div className="mb-6 flex items-center justify-between">
          <PortfolioTabs tab={tab} onTabChange={onTabChange} />
          <div className="flex gap-2">
            <CarouselPrevious className={INLINE_ARROW} />
            <CarouselNext className={INLINE_ARROW} />
          </div>
        </div>
        <CarouselContent>
          {view.positions.map(position => (
            <CarouselItem key={position.id} className={ITEM_BASIS}>
              <PositionCard position={position} onSelect={() => goToProduct(position.detailPath)} />
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
    </section>
  );
}

function ComingSoon() {
  // TODO(D1): Idle positions — wire wallet stablecoin balances once requirements land.
  return (
    <div className="mt-6 flex min-h-[180px] items-center justify-center">
      <Text variant="medium" className="text-textSecondary">
        <Trans>Coming soon.</Trans>
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
