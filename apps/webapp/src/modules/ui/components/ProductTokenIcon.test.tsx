import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Stub the token image — only the ring + symbol passthrough are under test.
vi.mock('./TokenIcon', () => ({
  TokenIcon: ({ token }: { token: { symbol: string } }) => <div data-testid="token-icon">{token.symbol}</div>
}));

import { ProductTokenIcon } from './ProductTokenIcon';

describe('ProductTokenIcon', () => {
  afterEach(cleanup);

  it('wraps the token icon in a 2px ring of the given color', () => {
    render(<ProductTokenIcon symbol="USDC" ringColor="#2973FF" />);

    const ring = screen.getByTestId('product-token-icon');
    expect(ring.getAttribute('style')).toMatch(/border:\s*2px solid/i);
    expect(ring.getAttribute('style')?.toLowerCase()).toContain('#2973ff');
    expect(screen.getByTestId('token-icon').textContent).toBe('USDC');
  });
});
