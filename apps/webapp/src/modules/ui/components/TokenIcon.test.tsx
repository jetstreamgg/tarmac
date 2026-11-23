import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TokenIcon } from './TokenIcon';

vi.mock('@/modules/ui/hooks/useChainImage', () => ({ useChainImage: () => undefined }));

// Wallets and third-party APIs can send a symbol that isn't a string; the
// types can't stop it, so the casts stand in for that runtime data.
const renderWithSymbol = (symbol: unknown) =>
  render(<TokenIcon token={{ symbol: symbol as string, name: 'Mystery' }} />);

describe('TokenIcon', () => {
  it('renders the symbol fallback for a string symbol', async () => {
    // The test DOM never loads the image, so the fallback shows after its
    // 500ms delay; give findByText headroom over that on slow runners.
    const { findByText } = renderWithSymbol('usds');
    expect(await findByText('USDS', undefined, { timeout: 3000 })).toBeTruthy();
  });

  it('renders nothing for a non-string symbol instead of throwing', () => {
    for (const symbol of [123, {}, null, undefined]) {
      const { container, unmount } = renderWithSymbol(symbol);
      expect(container.innerHTML).toBe('');
      unmount();
    }
  });
});
