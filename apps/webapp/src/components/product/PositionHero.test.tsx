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
    expect(screen.getByText('100,000')).not.toBeNull();
    expect(screen.getByText('.0002')).not.toBeNull();
  });

  it('renders a pre-formatted string figure whole', () => {
    renderHero({ balanceSymbol: 'SKY', amount: '12,345.67' });
    expect(screen.getByText('12,345.67')).not.toBeNull();
  });

  it('switches the fraction to the accruing counter when given a rate', () => {
    renderHero({ balanceSymbol: 'USDS', amount: 100_000, ratePerSecond: SSR_3_75 });

    // 100,000 USDS at 3.75% turns its 4th decimal over about once a second.
    const [tail, fraction] = screen.getAllByTestId('rolling-digits');
    expect(fraction.textContent).toBe('0000');
    // The whole part rolls only its last two digits; the rest stays as still
    // text ahead of them, so the figure still reads as one number.
    expect(tail.textContent).toBe('00');
    expect(screen.getByTestId('position-hero-whole').textContent).toBe('100,000');
    expect(screen.getAllByTestId('rolling-digit')).toHaveLength(6);
  });

  it('keeps the whole part still when the figure does not accrue', () => {
    renderHero({ balanceSymbol: 'USDS', amount: 100000.0002 });
    expect(screen.queryAllByTestId('rolling-digits')).toHaveLength(0);
  });

  it('rolls the units through a carry that widens the whole part', () => {
    const { rerender } = renderHero({ balanceSymbol: 'USDS', amount: 999.5, ratePerSecond: SSR_3_75 });
    expect(screen.getByTestId('position-hero-whole').textContent).toBe('999');
    rerender(
      <I18nProvider i18n={i18n}>
        <PositionHero balanceSymbol="USDS" amount={1000.5} ratePerSecond={SSR_3_75} />
      </I18nProvider>
    );
    // Both tail digits roll 9 → 0 (the outgoing 9s linger in the DOM for the
    // 200ms they take to leave); the head re-renders as still text.
    const [tail] = screen.getAllByTestId('rolling-digits');
    expect(tail.querySelectorAll('[data-testid="rolling-digit-out"]')).toHaveLength(2);
    const incoming = [...tail.querySelectorAll('[data-testid="rolling-digit-in"]')].map(n => n.textContent);
    expect(incoming).toEqual(['0', '0']);
    const whole = screen.getByTestId('position-hero-whole');
    expect(whole.firstChild?.textContent).toBe('1,0');
  });
});
