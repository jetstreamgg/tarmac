import { useMemo } from 'react';
import { Carousel, CarouselContent, CarouselItem, CarouselControls } from '@/components/ui/carousel';
import Autoplay from 'embla-carousel-autoplay';
import Fade from 'embla-carousel-fade';
import { AboutUsds } from '@/modules/ui/components/AboutUsds';
import { AboutSky } from '@/modules/ui/components/AboutSky';
import { AboutSpk } from '@/modules/ui/components/AboutSpk';
import { AboutSUsds } from '@/modules/ui/components/AboutSUsds';
import { BP, useBreakpointIndex } from '@/modules/ui/hooks/useBreakpointIndex';

export function AboutTokensCarousel() {
  const { bpi } = useBreakpointIndex();
  const isMobileOrTablet = bpi < BP['2xl'];

  const plugins = useMemo(
    () => [
      Autoplay({
        delay: 5000,
        stopOnInteraction: true,
        stopOnMouseEnter: true,
        stopOnFocusIn: true
      }),
      Fade()
    ],
    []
  );

  return (
    <Carousel opts={{ loop: true, watchDrag: isMobileOrTablet }} plugins={plugins} className="relative">
      <CarouselContent>
        <CarouselItem>
          <div className="pb-4">
            <AboutUsds />
          </div>
        </CarouselItem>
        {import.meta.env.VITE_RESTRICTED_BUILD !== 'true' && (
          <CarouselItem>
            <div className="pb-4">
              <AboutSUsds />
            </div>
          </CarouselItem>
        )}
        <CarouselItem>
          <div className="pb-4">
            <AboutSky />
          </div>
        </CarouselItem>
        <CarouselItem>
          <div className="pb-4">
            <AboutSpk />
          </div>
        </CarouselItem>
      </CarouselContent>
      <CarouselControls className="absolute bottom-1 left-1/2 -translate-x-1/2" />
    </Carousel>
  );
}
