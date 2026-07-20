import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { HeaderBadge, PageHeaderHero } from './page-header';

describe('PageHeaderHero — mobile type scale (M6.2, comp 486:22051)', () => {
  it('steps the hero title down to Heading 3 below md and keeps Heading 2 from md up', () => {
    render(<PageHeaderHero title="Your stablecoins, earning more" subtitle="Sky Protocol at work" />);

    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading.className).toContain('text-[32px]');
    expect(heading.className).toContain('leading-[35px]');
    expect(heading.className).toContain('md:text-[44px]');
    expect(heading.className).toContain('md:leading-[48px]');
  });
});

describe('HeaderBadge — mobile padding (M6.2, comp 486:22051)', () => {
  it('renders the m stat badge compact (28px) below md and 8px-padded from md up', () => {
    render(<HeaderBadge>$11.02B in circulation</HeaderBadge>);

    const badge = screen.getByText('$11.02B in circulation');
    expect(badge.className).toContain('py-1.5');
    expect(badge.className).toContain('md:p-2');
  });
});
