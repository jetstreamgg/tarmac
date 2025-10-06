import { useMemo, useEffect, useState, useRef } from 'react';
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
  const [carouselHeight, setCarouselHeight] = useState<number | undefined>(undefined);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastWidth = useRef<number>(0);
  const measureTimeoutRef = useRef<number | undefined>(undefined);

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

  useEffect(() => {
    // Calculate the tallest slide height
    const calculateHeight = () => {
      const currentWidth = containerRef.current?.offsetWidth || 0;

      // Only recalculate if width changed significantly (more than 1px to avoid rounding issues)
      if (lastWidth.current !== 0 && Math.abs(currentWidth - lastWidth.current) < 2) {
        return;
      }

      lastWidth.current = currentWidth;

      // Clear any pending measurement
      if (measureTimeoutRef.current) {
        clearTimeout(measureTimeoutRef.current);
      }

      // First, reset height to undefined to let cards measure naturally
      setCarouselHeight(undefined);

      // Wait for React to render with undefined height, then measure
      measureTimeoutRef.current = window.setTimeout(() => {
        const heights = slideRefs.current
          .filter((ref): ref is HTMLDivElement => ref !== null)
          .map(ref => ref.offsetHeight);

        if (heights.length > 0) {
          const maxHeight = Math.max(...heights);
          setCarouselHeight(maxHeight);
        }
      }, 50);
    };

    // Calculate on mount and after a brief delay to ensure content is rendered
    const timer = setTimeout(calculateHeight, 100);

    // Use ResizeObserver to watch for container size changes (e.g., chat pane open/close)
    const resizeObserver = new ResizeObserver(() => {
      calculateHeight();
    });

    // Observe the carousel container
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    // Also recalculate on window resize as fallback
    const handleResize = () => {
      calculateHeight();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      clearTimeout(timer);
      if (measureTimeoutRef.current) {
        clearTimeout(measureTimeoutRef.current);
      }
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, [bpi]);

  return (
    <div ref={containerRef}>
      <Carousel opts={{ loop: true, watchDrag: isMobileOrTablet }} plugins={plugins} className="relative">
        <CarouselContent>
          <CarouselItem>
            <div
              ref={el => {
                slideRefs.current[0] = el;
              }}
            >
              <AboutUsds height={carouselHeight} />
            </div>
          </CarouselItem>
          {import.meta.env.VITE_RESTRICTED_BUILD !== 'true' && (
            <CarouselItem>
              <div
                ref={el => {
                  slideRefs.current[1] = el;
                }}
              >
                <AboutSUsds height={carouselHeight} />
              </div>
            </CarouselItem>
          )}
          <CarouselItem>
            <div
              ref={el => {
                slideRefs.current[2] = el;
              }}
            >
              <AboutSky height={carouselHeight} />
            </div>
          </CarouselItem>
          <CarouselItem>
            <div
              ref={el => {
                slideRefs.current[3] = el;
              }}
            >
              <AboutSpk height={carouselHeight} />
            </div>
          </CarouselItem>
        </CarouselContent>
        <CarouselControls className="absolute -bottom-1 left-1/2 -translate-x-1/2" />
      </Carousel>
    </div>
  );
}
