import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { HeaderBadge, PageHeaderHero, PageHeading } from './page-header';

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

describe('PageHeading — badge + subtitle slots (1295:20810 title suffix)', () => {
  it('renders a bare heading when no slot is used', () => {
    render(<PageHeading>SKY Staking</PageHeading>);
    const heading = screen.getByRole('heading', { level: 1, name: 'SKY Staking' });
    expect(heading.parentElement?.className ?? '').not.toContain('gap-x-3');
  });

  it('puts badges beside the heading, outside it, on a 12px gap, and the subtitle under the row', () => {
    render(
      <PageHeading badges={<span data-testid="badge">Ethereum</span>} subtitle="26 Nov 2026">
        PT-USDG
      </PageHeading>
    );
    const heading = screen.getByRole('heading', { level: 1, name: 'PT-USDG' });
    const badge = screen.getByTestId('badge');
    expect(heading.contains(badge)).toBe(false);
    expect(heading.parentElement).toBe(badge.parentElement);
    expect(badge.parentElement?.className).toContain('gap-x-3');
    const subtitle = screen.getByText('26 Nov 2026');
    expect(heading.contains(subtitle)).toBe(false);
    expect(subtitle.className).toContain('font-graphik');
  });
});
