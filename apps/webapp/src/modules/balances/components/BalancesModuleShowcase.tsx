import { useRef } from 'react';
import { Carousel, CarouselContent, CarouselItem, CarouselControls } from '@/components/ui/carousel';
import Autoplay from 'embla-carousel-autoplay';
import Fade from 'embla-carousel-fade';
import { RewardsCard } from './modules/RewardsCard';
import { SavingsCard } from './modules/SavingsCard';
import { TradeCard } from './modules/TradeCard';
import { UpgradeCard } from './modules/UpgradeCard';
import { StakingRewardsCard } from './modules/StakingRewardsCard';
import { BP, useBreakpointIndex } from '@/modules/ui/hooks/useBreakpointIndex';

export function BalancesModuleShowcase() {
  const isRestrictedBuild = import.meta.env.VITE_RESTRICTED_BUILD === 'true';
  const isRestrictedMiCa = import.meta.env.VITE_RESTRICTED_BUILD_MICA === 'true';

  const { bpi } = useBreakpointIndex();
  const isMobileOrTablet = bpi < BP['2xl'];
  // Use a ref to tell the carousel what will be the root of the mouse events
  const carouselRef = useRef<HTMLDivElement>(null);

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
        {!isRestrictedBuild && (
          <CarouselItem>
            <RewardsCard />
          </CarouselItem>
        )}
        {!isRestrictedBuild && (
          <CarouselItem>
            <SavingsCard />
          </CarouselItem>
        )}
        <CarouselItem>
          <StakingRewardsCard />
        </CarouselItem>
        <CarouselItem>
          <UpgradeCard />
        </CarouselItem>
        {!isRestrictedMiCa && (
          <CarouselItem>
            <TradeCard />
          </CarouselItem>
        )}
      </CarouselContent>
      <CarouselControls className="absolute bottom-1 left-1/2 z-10 -translate-x-1/2 2xl:bottom-4" />
    </Carousel>
  );
}
