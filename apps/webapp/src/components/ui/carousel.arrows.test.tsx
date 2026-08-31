import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Carousel, CarouselArrows, CarouselContent, CarouselItem } from './carousel';

// jsdom lays nothing out, so embla is replaced by a stub api whose scroll
// ability the test controls.
const h = vi.hoisted(() => ({ canScrollPrev: false, canScrollNext: false }));

vi.mock('embla-carousel-react', () => ({
  default: () => [
    () => {},
    {
      canScrollPrev: () => h.canScrollPrev,
      canScrollNext: () => h.canScrollNext,
      selectedScrollSnap: () => 0,
      scrollSnapList: () => [0],
      scrollPrev: () => {},
      scrollNext: () => {},
      scrollTo: () => {},
      on: () => {},
      off: () => {}
    }
  ]
}));

const renderArrows = () =>
  render(
    <Carousel>
      <CarouselArrows data-testid="arrows" />
      <CarouselContent>
        <CarouselItem>one</CarouselItem>
      </CarouselContent>
    </Carousel>
  );

afterEach(() => cleanup());

describe('CarouselArrows', () => {
  it('renders nothing while every slide already fits', () => {
    h.canScrollPrev = false;
    h.canScrollNext = false;

    renderArrows();

    expect(screen.queryByTestId('arrows')).toBeNull();
  });

  it('renders the pair once the carousel can scroll', () => {
    h.canScrollPrev = false;
    h.canScrollNext = true;

    renderArrows();

    expect(screen.getByTestId('arrows')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Previous slide' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Next slide' })).toHaveProperty('disabled', false);
  });
});
