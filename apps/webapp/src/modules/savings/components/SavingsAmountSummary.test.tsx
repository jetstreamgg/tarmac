import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// TokenIcon pulls in async chain/token metadata that adds no signal to a layout test.
vi.mock('@/modules/ui/components/TokenIcon', () => ({ TokenIcon: () => null }));

import { SavingsAmountSummary } from './SavingsAmountSummary';

describe('SavingsAmountSummary', () => {
  afterEach(() => cleanup());

  it('renders the label, amount, symbol and $ USD subvalue', () => {
    render(
      <SavingsAmountSummary
        label="Supply amount"
        amount="10,000.00"
        symbol="USDS"
        usd="10,000.00"
        dataTestId="summary"
        usdTestId="summary-usd"
      />
    );
    const el = screen.getByTestId('summary');
    expect(el.textContent).toContain('Supply amount');
    expect(el.textContent).toContain('10,000.00');
    expect(el.textContent).toContain('USDS');
    expect(screen.getByTestId('summary-usd').textContent).toBe('$10,000.00');
  });

  it('omits the $ subvalue when usd is not provided', () => {
    render(<SavingsAmountSummary label="Supply amount" amount="0" symbol="USDS" usdTestId="summary-usd" />);
    expect(screen.queryByTestId('summary-usd')).toBeNull();
  });
});
