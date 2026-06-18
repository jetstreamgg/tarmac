import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

i18n.load('en', {});
i18n.activate('en');

vi.mock('wagmi', async importOriginal => {
  const actual = await importOriginal<typeof import('wagmi')>();
  return {
    ...actual,
    useChainId: () => 1,
    useChains: () => [{ id: 1, name: 'Ethereum' }]
  };
});

// TokenIcon pulls in async chain/token metadata that adds no signal to a layout test.
vi.mock('@/modules/ui/components/TokenIcon', () => ({
  TokenIcon: () => null
}));

import { SavingsSupplyReview } from './SavingsSupplyReview';

const renderReview = (props: Partial<Parameters<typeof SavingsSupplyReview>[0]> = {}) =>
  render(
    <I18nProvider i18n={i18n}>
      <SavingsSupplyReview
        amount="10,000.00"
        symbol="USDS"
        usd="10,000.00"
        youReceive="9,999.99 sUSDS"
        apy="3.60%"
        {...props}
      />
    </I18nProvider>
  );

describe('SavingsSupplyReview — Figma 527:7812 "Review supply"', () => {
  afterEach(() => cleanup());

  it('renders the $ USD subvalue beneath the amount when a usd value is present', () => {
    renderReview({ usd: '10,000.00' });
    expect(screen.getByTestId('savings-supply-review-usd').textContent).toBe('$10,000.00');
  });

  it('omits the $ subvalue when no usd value is given', () => {
    renderReview({ usd: undefined });
    expect(screen.queryByTestId('savings-supply-review-usd')).toBeNull();
  });

  it('shows the supplied amount header with the token symbol', () => {
    renderReview();
    const review = screen.getByTestId('savings-supply-review');
    expect(review.textContent).toContain('10,000.00');
    expect(review.textContent).toContain('USDS');
  });

  it('renders the Figma detail rows (You’ll receive / APY)', () => {
    renderReview();
    expect(screen.getByTestId("savings-review-row-You'll receive").textContent).toContain('9,999.99 sUSDS');
    expect(screen.getByTestId('savings-review-row-APY').textContent).toContain('3.60%');
  });
});
