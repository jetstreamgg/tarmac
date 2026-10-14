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
    expect(screen.getAllByTestId('rolling-digits').map(figure => figure.textContent)).toEqual([
      '100,000',
      '0000'
    ]);
    // Every digit on both sides of the point gets its own clip window, so a
    // carry into the whole dollars turns over one digit rather than the figure.
    expect(screen.getAllByTestId('rolling-digit')).toHaveLength(10);
    expect(screen.queryByTestId('rolling-value')).toBeNull();
  });

  it('sizes the figure from its glyph widths so a long total fits a narrow card', () => {
    renderHero({ balanceSymbol: 'SKY', amount: '125,000,000.00' });
    const figure = screen.getByText('125,000,000.00').closest('.\\@container') as HTMLElement;
    expect(Number(figure.style.getPropertyValue('--figure-em'))).toBeCloseTo(7.005, 3);
    expect(figure.style.getPropertyValue('--figure-reserve')).toBe('40px');
  });

  it('reserves room for the fraction beside the whole', () => {
    renderHero({ balanceSymbol: 'USDS', amount: 100000.0002 });
    const figure = screen.getAllByTestId('rolling-value')[0].closest('.\\@container') as HTMLElement;
    expect(Number(figure.style.getPropertyValue('--figure-em'))).toBeCloseTo(3.617, 3);
    // 40px for the token mark and gap, plus ".0002" at the 20px fraction size and its 1px gap.
    expect(parseFloat(figure.style.getPropertyValue('--figure-reserve'))).toBeCloseTo(92.88, 2);
  });

  it('sizes an accruing figure with tabular digits, which RollingDigits renders', () => {
    renderHero({ balanceSymbol: 'USDS', amount: 1_111_111, ratePerSecond: SSR_3_75 });
    const [whole, fraction] = screen.getAllByTestId('rolling-digits');
    expect(whole.textContent).toBe('1,111,111');
    const figure = whole.closest('.\\@container') as HTMLElement;
    // Seven 0.578em digits and two 0.276em commas, each tracked -0.02em.
    expect(Number(figure.style.getPropertyValue('--figure-em'))).toBeCloseTo(4.418, 3);
    const digits = fraction.textContent!.length;
    const fractionEm = 0.265 + digits * 0.578 - 0.02 * (digits + 1);
    expect(parseFloat(figure.style.getPropertyValue('--figure-reserve'))).toBeCloseTo(
      40 + fractionEm * 20 + 1,
      2
    );
  });
});
