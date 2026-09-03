import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

i18n.load('en', {});
i18n.activate('en');

vi.mock('@/modules/ui/components/TokenIcon', () => ({ TokenIcon: () => null }));

import { PositionHero } from './PositionHero';

/** Per-second growth of the 3.75% SSR. */
const SSR_3_75 = Math.expm1(Math.log1p(0.0375) / (365 * 24 * 60 * 60));

const renderHero = (props: Parameters<typeof PositionHero>[0]) =>
  render(
    <I18nProvider i18n={i18n}>
      <PositionHero {...props} />
    </I18nProvider>
  );

afterEach(cleanup);

describe('PositionHero', () => {
  it('renders a still figure without a rate, trimmed to 5 decimals', () => {
    renderHero({ balanceSymbol: 'USDS', amount: 100000.0002 });
    // Whole and fraction each roll over as one figure when the position changes.
    expect(screen.getAllByTestId('rolling-value').map(box => box.textContent)).toEqual(['100,000', '0002']);
    expect(screen.queryByTestId('rolling-digits')).toBeNull();
  });

  it('rolls the whole figure over when the position changes', () => {
    const { rerender } = renderHero({ balanceSymbol: 'USDS', amount: 1000 });
    rerender(
      <I18nProvider i18n={i18n}>
        <PositionHero balanceSymbol="USDS" amount={2500} />
      </I18nProvider>
    );
    expect(screen.getByTestId('rolling-value-out').textContent).toBe('1,000');
    expect(screen.getByTestId('rolling-value-in').textContent).toBe('2,500');
  });

  it('renders a pre-formatted string figure whole', () => {
    renderHero({ balanceSymbol: 'SKY', amount: '12,345.67' });
    expect(screen.getByText('12,345.67')).not.toBeNull();
  });

  it('switches the fraction to the accruing counter when given a rate', () => {
    renderHero({ balanceSymbol: 'USDS', amount: 100_000, ratePerSecond: SSR_3_75 });

    // 100,000 USDS at 3.75% turns its 4th decimal over about once a second.
    expect(screen.getByTestId('rolling-digits').textContent).toBe('0000');
    // Each digit gets its own clip window to roll inside — and only the
    // fraction does, so the 44px whole part stays out of them.
    expect(screen.getAllByTestId('rolling-digit')).toHaveLength(4);
    expect(screen.getByText('100,000')).not.toBeNull();
  });
});
