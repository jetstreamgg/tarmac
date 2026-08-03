import { useNavigate } from '@tanstack/react-router';
import { Trans } from '@lingui/react/macro';
import type { EarnProductRow } from '@/hooks';
import { retainOnNavigate } from '@/lib/navigation';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext
} from '@/components/ui/carousel';
import { Heading } from '@/modules/layout/components/Typography';
import { EarnMarketplaceCard } from './EarnMarketplaceCard';

// Each card spans a fraction of the row so 1 (mobile) → 3 (desktop) show at once.
const ITEM_BASIS = 'basis-full sm:basis-1/2 desktop:basis-1/3';
// Neutralizes CarouselPrevious/Next's default absolute positioning so the
// arrows sit inline in the section header (matches the supplied carousel).
const INLINE_ARROW = 'static left-auto right-auto top-auto translate-y-0';

/**
 * The "Earn with Sky" carousel: every Earn marketplace product rendered as a
 * card (vs the Earn page's table rows). Shown to disconnected visitors and as
 * promotion for connected users without a meaningful position.
 */
export function EarnMarketplaceSection({ rows, isLoading }: { rows: EarnProductRow[]; isLoading: boolean }) {
  const navigate = useNavigate();
  const goToProduct = (detailPath: string) =>
    void navigate({ to: detailPath as '/', search: retainOnNavigate });

  if (isLoading && rows.length === 0) {
    return (
      <section data-testid="earn-marketplace-section">
        <Heading tag="h2" variant="medium" className="mb-6">
          <Trans>Earn with Sky</Trans>
        </Heading>
        <CarouselSkeleton />
      </section>
    );
  }

  return (
    <section data-testid="earn-marketplace-section">
      <Carousel opts={{ align: 'start', slidesToScroll: 'auto', containScroll: 'trimSnaps' }}>
        <div className="mb-6 flex items-center justify-between gap-4">
          <Heading tag="h2" variant="medium">
            <Trans>Earn with Sky</Trans>
          </Heading>
          {/* Same DS Button / Icon pair as the positions carousel. */}
          <div className="flex gap-1.5">
            <CarouselPrevious variant="secondary" size="iconS" className={INLINE_ARROW} />
            <CarouselNext variant="secondary" size="iconS" className={INLINE_ARROW} />
          </div>
        </div>
        <CarouselContent>
          {rows.map(row => (
            <CarouselItem key={row.id} className={ITEM_BASIS}>
              <EarnMarketplaceCard row={row} onStart={() => goToProduct(row.detailPath)} />
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
    <div className="desktop:grid-cols-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="bg-surface h-[360px] animate-pulse rounded-3xl" />
      <div className="bg-surface hidden h-[360px] animate-pulse rounded-3xl sm:block" />
      <div className="bg-surface desktop:block hidden h-[360px] animate-pulse rounded-3xl" />
    </div>
  );
}
