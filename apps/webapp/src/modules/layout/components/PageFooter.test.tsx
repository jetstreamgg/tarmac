import { describe, expect, it, vi, beforeEach } from 'vitest';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render as rtlRender, screen } from '@testing-library/react';
import { PageFooter } from './PageFooter';

i18n.load('en', {});
i18n.activate('en');

const render = () =>
  rtlRender(
    <I18nProvider i18n={i18n}>
      <PageFooter />
    </I18nProvider>
  );

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
    render();

    expect(screen.getByText(`© ${new Date().getFullYear()} All rights reserved`)).toBeTruthy();
  });

  // The landing footer's first two paragraphs; its third (forward-looking
  // statements) is deliberately left off.
  it('renders both disclaimer paragraphs and no more', () => {
    render();

    const paragraphs = screen.getByTestId('page-footer-disclaimer').querySelectorAll('p');
    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[0].textContent).toMatch(/^IMPORTANT DISCLAIMER: Skybase International operates/);
    expect(paragraphs[1].textContent).toMatch(/^Skybase International does not guarantee any level of yield/);
    expect(screen.queryByText(/FORWARD-LOOKING STATEMENTS/)).toBeNull();
  });

  it('renders the configured legal links, opening them in a new tab', () => {
    render();

    const terms = screen.getByRole('link', { name: 'Terms of Use' });
    expect(terms.getAttribute('href')).toBe('https://docs.sky.money/legal-terms');
    expect(terms.getAttribute('target')).toBe('_blank');
    expect(screen.getByRole('link', { name: 'User Risk Documentation' })).toBeTruthy();
  });

  // The footer carries the legal documents only; the deployment's non-legal
  // entries stay in the More menu.
  it('drops non-legal links such as Bug Bounty', () => {
    mocks.footerLinks = [
      { url: 'https://docs.sky.money/legal-terms', name: 'Terms of Use' },
      { url: 'https://docs.sky.money/legal-terms#privacy-policy', name: 'Privacy Policy' },
      { url: 'https://docs.sky.money/user-risks', name: 'User Risk Documentation' },
      { url: 'https://immunefi.com/bug-bounty/sky/information/', name: 'Bug Bounty' }
    ];

    render();

    expect(screen.getAllByRole('link').map(a => a.textContent)).toEqual([
      'Terms of Use',
      'Privacy Policy',
      'User Risk Documentation'
    ]);
  });

  it('drops links that fail the allow-list sanitizer', () => {
    // Legal by name, so only the sanitizer can reject it.
    mocks.footerLinks = [
      { url: 'https://docs.sky.money/legal-terms', name: 'Terms of Use' },
      { url: 'http://evil.example.com', name: 'Privacy Policy' }
    ];

    render();

    expect(screen.queryByRole('link', { name: 'Privacy Policy' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Terms of Use' })).toBeTruthy();
  });

  it('still renders the copyright when no links are configured', () => {
    mocks.footerLinks = [];

    render();

    expect(screen.getByTestId('page-footer')).toBeTruthy();
    expect(screen.queryByRole('link')).toBeNull();
  });
});
