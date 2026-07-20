import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EarnMarketplaceSection } from './EarnMarketplaceSection';
import type { EarnProductRow } from '@/hooks';
import { Intent } from '@/lib/enums';

i18n.load('en', {});
i18n.activate('en');

const h = vi.hoisted(() => ({ navigate: vi.fn() }));

vi.mock('@tanstack/react-router', () => ({ useNavigate: () => h.navigate }));

// Carousel → passthroughs so the cards render flat (no embla/DOM coupling).
vi.mock('@/components/ui/carousel', () => ({
  Carousel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CarouselContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CarouselItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CarouselPrevious: () => <button type="button" />,
  CarouselNext: () => <button type="button" />
}));

// Not under test — stub to keep the render light.
vi.mock('@/modules/ui/components/TokenIcon', () => ({ TokenIcon: () => null }));

const row = (over: Partial<EarnProductRow>): EarnProductRow => ({
  id: 'x',
  kind: 'savings',
  riskProfile: 'savings',
  intent: Intent.SAVINGS_INTENT,
  name: 'X',
  tokenSymbol: 'USDS',
  supplyTokens: ['USDS'],
  risk: 'low',
  networks: [1],
  detailPath: '/earn/savings',
  rate: { value: 0.0375, formatted: '3.75%' },
  isLoading: false,
  error: null,
  ...over
});

afterEach(() => cleanup());

describe('EarnMarketplaceSection', () => {
  beforeEach(() => h.navigate.mockClear());

  it('renders a card per row and routes Start earning to the product page', () => {
    render(
      <I18nProvider i18n={i18n}>
        <EarnMarketplaceSection
          rows={[
            row({ id: 'savings', name: 'Sky Savings Rate', detailPath: '/earn/savings' }),
            row({
              id: 'vault-morpho-1',
              kind: 'vault',
              name: 'Flagship',
              detailPath: '/earn/vaults/morpho/1'
            })
          ]}
          isLoading={false}
        />
      </I18nProvider>
    );

    expect(screen.getAllByTestId('earn-marketplace-card')).toHaveLength(2);

    fireEvent.click(screen.getAllByTestId('earn-marketplace-card-start')[1]);

    expect(h.navigate).toHaveBeenCalledTimes(1);
    expect(h.navigate.mock.calls[0][0].to).toBe('/earn/vaults/morpho/1');
  });

  it('shows a skeleton (no cards) while loading with no rows yet', () => {
    render(
      <I18nProvider i18n={i18n}>
        <EarnMarketplaceSection rows={[]} isLoading />
      </I18nProvider>
    );

    expect(screen.queryByTestId('earn-marketplace-card')).toBeNull();
  });
});
