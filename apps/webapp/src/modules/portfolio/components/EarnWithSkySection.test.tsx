import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EarnWithSkySection } from './EarnWithSkySection';
import type { EarnWithSkyProduct } from '../helpers/earnWithSky';

i18n.load('en', {});
i18n.activate('en');

const h = vi.hoisted(() => ({ navigate: vi.fn() }));

vi.mock('@tanstack/react-router', () => ({ useNavigate: () => h.navigate }));

// Carousel → passthroughs so the cards render flat (no embla/DOM coupling).
vi.mock('@/components/ui/carousel', () => ({
  Carousel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CarouselContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CarouselItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CarouselArrows: () => null
}));

// Not under test — stub to keep the render light.
vi.mock('@/modules/ui/components/TokenIcon', () => ({ TokenIcon: () => null }));

const product = (over: Partial<EarnWithSkyProduct> & Pick<EarnWithSkyProduct, 'id'>): EarnWithSkyProduct => ({
  rate: { value: 0.0375, formatted: '3.75%' },
  isBestOf: false,
  supplyTokens: ['USDS'],
  riskProfile: 'savings',
  to: { path: '/earn/savings' },
  isLoading: false,
  ...over
});

const renderSection = (products: EarnWithSkyProduct[], isLoading = false) =>
  render(
    <I18nProvider i18n={i18n}>
      <EarnWithSkySection products={products} isLoading={isLoading} />
    </I18nProvider>
  );

afterEach(() => cleanup());

describe('EarnWithSkySection', () => {
  beforeEach(() => h.navigate.mockClear());

  it('renders a card per product group with its copy and rate', () => {
    renderSection([
      product({ id: 'savings' }),
      product({
        id: 'vaults',
        rate: { value: 0.0591, formatted: '5.91%' },
        isBestOf: true,
        riskProfile: 'vault-flagship'
      }),
      product({ id: 'stake', rate: { value: 0.105, formatted: '10.50%' }, riskProfile: 'stake' })
    ]);

    const cards = screen.getAllByTestId('earn-with-sky-card');
    expect(cards.map(card => card.dataset.product)).toEqual(['savings', 'vaults', 'stake']);
    expect(cards[0].textContent).toContain('sUSDS');
    expect(cards[0].textContent).toContain('Access sUSDS');
    expect(cards[1].textContent).toContain('Vaults');
    expect(cards[1].textContent).toContain('Launch Vaults');
    expect(cards[2].textContent).toContain('Stake SKY');
    expect(cards[2].textContent).toContain('Access SKY');

    const rates = screen.getAllByTestId('earn-with-sky-card-rate');
    expect(rates.map(rate => rate.textContent)).toEqual(['3.75%', 'up to 5.91%', '10.50%']);
  });

  it('hides the rate badge while the rate is unknown', () => {
    renderSection([product({ id: 'savings', rate: { formatted: '—' }, isLoading: true })]);

    expect(screen.queryByTestId('earn-with-sky-card-rate')).toBeNull();
  });

  it('routes each CTA to its destination, carrying Earn-list deep-link extras', () => {
    renderSection([
      product({ id: 'savings' }),
      product({
        id: 'vaults',
        to: { path: '/earn', search: { product: 'vault' }, hash: 'earn-opportunities' }
      }),
      product({ id: 'stake', to: { path: '/stake' } })
    ]);

    const starts = screen.getAllByTestId('earn-with-sky-card-start');
    fireEvent.click(starts[1]);
    fireEvent.click(starts[2]);

    expect(h.navigate).toHaveBeenCalledTimes(2);
    const [vaultsCall, stakeCall] = h.navigate.mock.calls.map(call => call[0]);
    expect(vaultsCall.to).toBe('/earn');
    expect(vaultsCall.hash).toBe('earn-opportunities');
    expect(vaultsCall.search({ network: 'ethereum', flow: 'x' })).toEqual({
      network: 'ethereum',
      product: 'vault'
    });
    expect(stakeCall.to).toBe('/stake');
    expect(stakeCall.hash).toBeUndefined();
    expect(stakeCall.search({ network: 'ethereum' })).toEqual({ network: 'ethereum' });
  });

  it('shows a skeleton (no cards) while loading with no products yet', () => {
    renderSection([], true);

    expect(screen.queryByTestId('earn-with-sky-card')).toBeNull();
  });
});
