import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { PromoBanner, BannerAccent } from './PromoBanner';

afterEach(cleanup);

describe('PromoBanner', () => {
  it('renders the illustration, heading, subtitle and action slots', () => {
    render(
      <PromoBanner
        dataTestId="promo"
        illustration={<img src="/x.png" alt="Illustration" />}
        heading={<p>Heading text</p>}
        subtitle={<p>Subtitle text</p>}
        action={<button>Do it</button>}
      />
    );
    expect(screen.getByTestId('promo')).toBeTruthy();
    expect(screen.getByAltText('Illustration')).toBeTruthy();
    expect(screen.getByText('Heading text')).toBeTruthy();
    expect(screen.getByText('Subtitle text')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Do it' })).toBeTruthy();
  });
});

describe('BannerAccent', () => {
  it('renders its content', () => {
    render(<BannerAccent>Accent phrase</BannerAccent>);
    expect(screen.getByText('Accent phrase')).toBeTruthy();
  });
});
