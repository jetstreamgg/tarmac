import { useRef, useMemo } from 'react';
import { Carousel, CarouselContent, CarouselItem, CarouselControls } from '@/components/ui/carousel';
import Autoplay from 'embla-carousel-autoplay';
import Fade from 'embla-carousel-fade';
import { RewardsCard } from './modules/RewardsCard';
import { SavingsCard } from './modules/SavingsCard';
import { TradeCard } from './modules/TradeCard';
import { UpgradeCard } from './modules/UpgradeCard';
import { StakingRewardsCard } from './modules/StakingRewardsCard';
import { ExpertCard } from './modules/ExpertCard';
import { BP, useBreakpointIndex } from '@/modules/ui/hooks/useBreakpointIndex';

type CarouselCard = {
  id: string;
  component: React.ReactNode;
  hideInRestrictedBuild?: boolean;
  hideInMiCaRestricted?: boolean;
  featured?: boolean;
};

export function BalancesModuleShowcase() {
  const isRestrictedBuild = import.meta.env.VITE_RESTRICTED_BUILD === 'true';
  const isRestrictedMiCa = import.meta.env.VITE_RESTRICTED_BUILD_MICA === 'true';

  const { bpi } = useBreakpointIndex();
  const isMobileOrTablet = bpi < BP['2xl'];
  // Use a ref to tell the carousel what will be the root of the mouse events
  const carouselRef = useRef<HTMLDivElement>(null);

  const allCards: CarouselCard[] = useMemo(
    () => [
      {
        id: 'rewards',
        component: <RewardsCard />,
        hideInRestrictedBuild: true
      },
      {
        id: 'savings',
        component: <SavingsCard />,
        hideInRestrictedBuild: true
      },
      {
        id: 'staking',
        component: <StakingRewardsCard />,
        featured: true // Featured cards go first
      },
      {
        id: 'upgrade',
        component: <UpgradeCard />
      },
      {
        id: 'trade',
        component: <TradeCard />,
        hideInMiCaRestricted: true
      },
      {
        id: 'expert',
        component: <ExpertCard />,
        hideInRestrictedBuild: true
      }
    ],
    []
  );

  // Filter cards based on restrictions and sort by featured status
  const visibleCards = useMemo(() => {
    const filtered = allCards.filter(card => {
      if (card.hideInRestrictedBuild && isRestrictedBuild) return false;
      if (card.hideInMiCaRestricted && isRestrictedMiCa) return false;
      return true;
    });

    // Separate featured and non-featured cards
    const featuredCards = filtered.filter(card => card.featured);
    const regularCards = filtered.filter(card => !card.featured);

    // Combine with featured cards first, maintaining original order within each group
    return [...featuredCards, ...regularCards];
  }, [allCards, isRestrictedBuild, isRestrictedMiCa]);

  return (
    <Carousel
      ref={carouselRef}
      opts={{ loop: true, watchDrag: isMobileOrTablet }}
      plugins={[
        Autoplay({
          delay: 5000,
          stopOnInteraction: false,
          stopOnMouseEnter: true,
          rootNode: emblaRoot => carouselRef.current || emblaRoot
        }),
        Fade()
      ]}
      className="relative mb-8"
    >
      <CarouselContent>
        {visibleCards.map(card => (
          <CarouselItem key={card.id}>{card.component}</CarouselItem>
        ))}
      </CarouselContent>
      <CarouselControls className="absolute bottom-1 left-1/2 z-10 -translate-x-1/2 2xl:bottom-4" />
    </Carousel>
  );
}
