import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// TokenIcon pulls in async chain/token metadata that adds no signal to a layout test.
vi.mock('@/modules/ui/components/TokenIcon', () => ({ TokenIcon: () => null }));

import { TransactionAmountHero } from './TransactionAmountHero';

describe('TransactionAmountHero', () => {
  afterEach(() => cleanup());

  it('renders the label, amount, token badge and $ USD subvalue', () => {
    render(
      <TransactionAmountHero
        label="Supply amount"
        amount="10,000.00"
        symbol="USDS"
        usd="10,000.00"
        dataTestId="hero"
        usdTestId="hero-usd"
      />
    );
    const el = screen.getByTestId('hero');
    expect(el.textContent).toContain('Supply amount');
    expect(el.textContent).toContain('10,000.00');
    expect(el.textContent).toContain('USDS');
    expect(screen.getByTestId('hero-usd').textContent).toBe('$10,000.00');
  });

  it('omits the label and $ subvalue when not provided', () => {
    render(<TransactionAmountHero amount="0" symbol="USDS" usdTestId="hero-usd" dataTestId="hero" />);
    expect(screen.queryByTestId('hero-usd')).toBeNull();
    expect(screen.getByTestId('hero').textContent).toContain('0');
  });
});
