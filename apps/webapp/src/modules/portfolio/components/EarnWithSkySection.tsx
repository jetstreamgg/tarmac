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
import { Skeleton } from '@/components/ui/skeleton';
import { Heading } from '@/modules/layout/components/Typography';
import { EarnWithSkyCard } from './EarnWithSkyCard';
import { setPendingNavIntent } from '@/modules/analytics/lib/navigationIntent';
import type { EarnWithSkyDestination, EarnWithSkyProduct } from '../helpers/earnWithSky';

// Each card spans a fraction of the row so 1 (mobile) → 3 (desktop) show at once.
const ITEM_BASIS = 'basis-full sm:basis-1/2 desktop:basis-1/3';
// Neutralizes CarouselPrevious/Next's default absolute positioning so the
// arrows sit inline in the section header (matches the supplied carousel).
const INLINE_ARROW = 'static left-auto right-auto top-auto translate-y-0';

/**
 * The "Earn with Sky" carousel (Figma 2376:225231, APP-531): the three fixed
 * product groups — sUSDS, Vaults, Stake SKY — as cards, shown to disconnected
 * visitors. The cards come from useEarnWithSkyProducts; this only lays them
 * out and routes their CTAs.
 */
export function EarnWithSkySection({
  products,
  isLoading
}: {
  products: EarnWithSkyProduct[];
  isLoading: boolean;
}) {
  const navigate = useNavigate();
  const goToProduct = ({ path, search, hash }: EarnWithSkyDestination) => {
    setPendingNavIntent('card', path);
    void navigate({
      to: path as '/',
      search: prev => ({ ...retainOnNavigate(prev), ...search }),
      hash
    });
  };

  if (isLoading && products.length === 0) {
    return (
      <section data-testid="earn-with-sky-section">
        <Heading tag="h2" variant="medium" className="mb-6">
          <Trans>Earn with Sky</Trans>
        </Heading>
        <CarouselSkeleton />
      </section>
    );
  }

  return (
    <section data-testid="earn-with-sky-section">
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
          {products.map(product => (
            <CarouselItem key={product.id} className={ITEM_BASIS}>
              <EarnWithSkyCard product={product} onStart={() => goToProduct(product.to)} />
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
      <Skeleton className="h-[360px] rounded-3xl" />
      <Skeleton className="hidden h-[360px] rounded-3xl sm:block" />
      <Skeleton className="desktop:block hidden h-[360px] rounded-3xl" />
    </div>
  );
}
