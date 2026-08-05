import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PageFooter } from './PageFooter';

const mocks = vi.hoisted(() => ({ footerLinks: [] as { url: string; name: string; highlight?: string }[] }));

vi.mock('@/lib/utils', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/utils')>();
  return { ...actual, getFooterLinks: () => mocks.footerLinks };
});

beforeEach(() => {
  mocks.footerLinks = [
    { url: 'https://docs.sky.money/legal-terms', name: 'Terms of Use' },
    { url: 'https://docs.sky.money/user-risks', name: 'User Risk Documentation' }
  ];
});

describe('PageFooter', () => {
  it('renders the copyright line for the current year', () => {
    render(<PageFooter />);

    expect(screen.getByText(`© ${new Date().getFullYear()} All rights reserved`)).toBeTruthy();
  });

  it('renders the configured legal links, opening them in a new tab', () => {
    render(<PageFooter />);

    const terms = screen.getByRole('link', { name: 'Terms of Use' });
    expect(terms.getAttribute('href')).toBe('https://docs.sky.money/legal-terms');
    expect(terms.getAttribute('target')).toBe('_blank');
    expect(screen.getByRole('link', { name: 'User Risk Documentation' })).toBeTruthy();
  });

  it('drops links that fail the allow-list sanitizer', () => {
    mocks.footerLinks = [
      { url: 'https://docs.sky.money/legal-terms', name: 'Terms of Use' },
      { url: 'http://evil.example.com', name: 'Nope' }
    ];

    render(<PageFooter />);

    expect(screen.queryByRole('link', { name: 'Nope' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Terms of Use' })).toBeTruthy();
  });

  it('still renders the copyright when no links are configured', () => {
    mocks.footerLinks = [];

    render(<PageFooter />);

    expect(screen.getByTestId('page-footer')).toBeTruthy();
    expect(screen.queryByRole('link')).toBeNull();
  });
});
